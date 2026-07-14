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

    Coexists with SimpleJWT during the phased migration (settings.py lists
    this class first): returns None — never raises — when Entra isn't
    configured for this environment, or the bearer token isn't a JWT this
    class can even parse, so DRF falls through to SimpleJWT instead of
    rejecting the request outright. Only a token that *is* a parseable JWT
    but fails validation (bad audience/issuer/signature/expiry) raises
    AuthenticationFailed (401) — such a token was never a valid SimpleJWT
    token either, so there's nothing to fall through to.
    """

    def authenticate(self, request):
        if not settings.ENTRA_JWKS_URL or not settings.ENTRA_API_CLIENT_ID:
            return None

        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None
        token = header[len("Bearer "):]

        jwks_client = _jwks_client(settings.ENTRA_JWKS_URL)
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except jwt.exceptions.PyJWKClientError:
            return None  # not one of ours (e.g. a SimpleJWT token) — fall through
        except jwt.exceptions.DecodeError:
            return None  # not even a well-formed JWT — fall through

        try:
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=settings.ENTRA_API_CLIENT_ID,
                issuer=settings.ENTRA_ISSUER,
            )
        except jwt.exceptions.InvalidTokenError as exc:
            raise AuthenticationFailed(f"Invalid Entra token: {exc}") from exc

        user = get_or_provision_user(claims)
        return (user, token)

    def authenticate_header(self, request):
        # DRF's APIView.get_authenticate_header() only ever consults the
        # *first* configured authenticator (see rest_framework.views) — since
        # this class is listed first for coexistence, omitting this would
        # silently turn every authentication failure app-wide (including
        # SimpleJWT's) from 401 into 403.
        return 'Bearer realm="api"'
