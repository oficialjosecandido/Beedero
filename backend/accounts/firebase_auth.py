from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from beedero.firebase import get_firebase_app

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

    def authenticate(self, request):
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

        return (get_or_provision_firebase_user(claims), token)

    def authenticate_header(self, request):
        return self.keyword
