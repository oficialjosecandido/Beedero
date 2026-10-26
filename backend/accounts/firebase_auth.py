from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from beedero.firebase import get_firebase_app

from .activity import record_presence
from .provisioning import get_or_provision_firebase_user


class FirebaseIDTokenAuthentication(BaseAuthentication):
    """Validates Firebase Authentication ID tokens and resolves them to a
    local `User` (see accounts/provisioning.py).

    The sole authentication class, replacing EntraJWTAuthentication.

    Returns None — treating the request as anonymous, so `IsAuthenticated`
    turns it into a 401 — when there's no bearer token at all. A token that IS
    present but fails validation raises AuthenticationFailed instead, so a
    genuinely bad token is never silently downgraded to "anonymous".

    Note the deliberate difference from notifications/push.py: when Firebase
    isn't configured, push no-ops, but this refuses every authenticated
    request. Failing open here would make the API world-readable the moment a
    credential went missing.
    """

    keyword = "Bearer"

    # Where the outcome of this request's single verification is kept. Set on
    # the underlying HttpRequest and nowhere else — see `authenticate`.
    _CACHE_ATTR = "_firebase_auth_outcome"

    def authenticate(self, request):
        """PERF-04: verify the token once per request, not twice.

        Every API call authenticates twice: RLSViewerMiddleware needs the
        viewer before Postgres runs a single statement, which is earlier than
        DRF's authentication classes can run (orgs/middleware.py explains
        why), and then DRF does it again in `dispatch`. That meant two
        signature verifications, two user lookups and two `record_presence`
        calls per request, the second one re-reading the row the first had
        just written.

        The outcome is cached on the underlying `HttpRequest`, which is the
        one object both callers share: DRF wraps it and exposes it as
        `_request`. Scoped to a single request and never beyond it — a cache
        that outlived the request would keep accepting a token after it had
        expired or been revoked, which is exactly the check this class exists
        to perform.
        """
        carrier = getattr(request, "_request", request)
        cached = getattr(carrier, self._CACHE_ATTR, None)
        if cached is not None:
            failure, result = cached
            if failure is not None:
                raise AuthenticationFailed(failure)
            return result

        try:
            result = self._authenticate(request)
        except AuthenticationFailed as exc:
            # Cached too: a bad token must fail the same way at both call
            # sites, without paying for a second round of verification.
            setattr(carrier, self._CACHE_ATTR, (exc.detail, None))
            raise
        setattr(carrier, self._CACHE_ATTR, (None, result))
        return result

    def _authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith(f"{self.keyword} "):
            return None
        token = header[len(self.keyword) + 1:].strip()
        if not token:
            return None

        app = get_firebase_app()
        if app is None:
            raise AuthenticationFailed("Firebase authentication is not configured.")

        from firebase_admin import auth as firebase_auth

        try:
            claims = firebase_auth.verify_id_token(token, app=app)
        except firebase_auth.ExpiredIdTokenError as exc:
            # Distinct message so the client knows to refresh rather than
            # bounce the user to the login page.
            raise AuthenticationFailed("Firebase ID token has expired.") from exc
        except (firebase_auth.InvalidIdTokenError, ValueError) as exc:
            raise AuthenticationFailed(f"Invalid Firebase token: {exc}") from exc

        # Beedero signs people in one way only: a link emailed to them, which
        # always yields email_verified. Firebase, though, requires the
        # email/password provider to be switched on before it will do email
        # links at all — so the project also answers accounts:signUp, and the
        # Web API key that reaches it is public by design. Without this check,
        # anyone could mint an account against any address they don't own.
        #
        # Nothing legitimate lands here unverified, so this costs real users
        # nothing.
        if not claims.get("email_verified"):
            raise AuthenticationFailed("Firebase account has no verified email address.")

        user = get_or_provision_firebase_user(claims)
        record_presence(user)
        return (user, token)

    def authenticate_header(self, request):
        return self.keyword
