from functools import lru_cache

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .provisioning import get_or_provision_user


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> "jwt.PyJWKClient":
    return jwt.PyJWKClient(jwks_url, cache_keys=True)


class EntraJWTAuthentication(BaseAuthentication):
    """Validates Microsoft Entra External ID access tokens (RS256, verified
    against the tenant's public JWKS) and JIT-provisions a local shadow
    `User` keyed by the token's `oid` claim.

    The sole authentication class (native email/password auth was removed).
    Returns None — never raises — when Entra isn't configured for this
    environment, or the bearer token isn't a JWT at all, so the request is
    treated as anonymous (401 via IsAuthenticated) rather than crashing. Only
    a token that *is* a parseable JWT but fails validation (bad
    audience/issuer/signature/expiry) raises AuthenticationFailed (401).
    """

    def authenticate(self, request):
        # TEMP DIAGNOSTIC — remove once the /feed post-login 401 bug is root-caused.
        if not settings.ENTRA_JWKS_URL or not settings.ENTRA_API_CLIENT_ID:
            print("[diag entra_auth] missing config: JWKS_URL=%r CLIENT_ID=%r" % (
                settings.ENTRA_JWKS_URL, settings.ENTRA_API_CLIENT_ID), flush=True)
            return None

        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            print("[diag entra_auth] header not Bearer-prefixed: %r" % (header[:20],), flush=True)
            return None
        token = header[len("Bearer "):]
        print("[diag entra_auth] token prefix=%r len=%d" % (token[:16], len(token)), flush=True)

        jwks_client = _jwks_client(settings.ENTRA_JWKS_URL)
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except jwt.exceptions.PyJWKClientError as exc:
            print("[diag entra_auth] PyJWKClientError: %r (jwks_url=%s)" % (exc, settings.ENTRA_JWKS_URL), flush=True)
            return None  # not a token this tenant's JWKS can resolve
        except jwt.exceptions.DecodeError as exc:
            print("[diag entra_auth] DecodeError: %r" % (exc,), flush=True)
            return None  # not even a well-formed JWT

        try:
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=settings.ENTRA_API_CLIENT_ID,
                issuer=settings.ENTRA_ISSUER,
            )
        except jwt.exceptions.InvalidTokenError as exc:
            print("[diag entra_auth] InvalidTokenError: %r (aud=%s iss=%s)" % (
                exc, settings.ENTRA_API_CLIENT_ID, settings.ENTRA_ISSUER), flush=True)
            raise AuthenticationFailed(f"Invalid Entra token: {exc}") from exc

        print("[diag entra_auth] validated ok, oid=%s" % claims.get("oid"), flush=True)
        user = get_or_provision_user(claims)
        return (user, token)

    def authenticate_header(self, request):
        # Without this, DRF's APIView.get_authenticate_header() has nothing
        # to consult and every authentication failure app-wide silently
        # turns from 401 into 403 (see rest_framework.views).
        return 'Bearer realm="api"'
