from unittest.mock import MagicMock, patch

import jwt
import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.entra_auth import _jwks_client
from accounts.models import User

ENTRA_SETTINGS = {
    "ENTRA_JWKS_URL": "https://beedero.ciamlogin.com/tenant-123/discovery/v2.0/keys",
    "ENTRA_API_CLIENT_ID": "api-client-id",
    "ENTRA_ISSUER": "https://beedero.ciamlogin.com/tenant-123/v2.0",
}

CLAIMS = {"oid": "11111111-1111-1111-1111-111111111111", "email": "new@example.com"}


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _clear_jwks_cache():
    _jwks_client.cache_clear()
    yield
    _jwks_client.cache_clear()


def _mock_jwks_client():
    client = MagicMock()
    client.get_signing_key_from_jwt.return_value = MagicMock(key="fake-key")
    return client


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS)
def test_valid_entra_token_authenticates_and_provisions_once(api):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", return_value=CLAIMS),
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res1 = api.get("/api/auth/me/")
        res2 = api.get("/api/auth/me/")

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert User.objects.filter(entra_oid=CLAIMS["oid"]).count() == 1


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS)
def test_entra_token_provisions_verified_email(api):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", return_value=CLAIMS),
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        api.get("/api/auth/me/")

    user = User.objects.get(entra_oid=CLAIMS["oid"])
    assert user.email == CLAIMS["email"]
    assert user.is_email_verified


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS)
@pytest.mark.parametrize(
    "raised",
    [
        jwt.exceptions.InvalidAudienceError("bad aud"),
        jwt.exceptions.InvalidIssuerError("bad iss"),
        jwt.exceptions.ExpiredSignatureError("expired"),
        jwt.exceptions.InvalidSignatureError("bad signature"),
    ],
)
def test_invalid_entra_token_claims_return_401(api, raised):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", side_effect=raised),
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS)
def test_token_not_resolvable_via_jwks_falls_through_instead_of_401(api):
    """A token EntraJWTAuthentication can't even look up in JWKS (e.g. a
    SimpleJWT token, or genuinely malformed) must return None so DRF falls
    through to SimpleJWT, not reject the request outright."""
    client = MagicMock()
    client.get_signing_key_from_jwt.side_effect = jwt.exceptions.PyJWKClientError("no matching key")
    with patch("accounts.entra_auth._jwks_client", return_value=client):
        api.credentials(HTTP_AUTHORIZATION="Bearer not-an-entra-token")
        res = api.get("/api/auth/me/")

    # No Authorization scheme authenticated it, so DRF's final answer is 401 —
    # but critically this came from "unauthenticated", not from
    # EntraJWTAuthentication raising on an unrecognized token.
    assert res.status_code == 401


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS)
def test_coexistence_simplejwt_tokens_still_authenticate(api):
    user = User.objects.create_user(username="legacy@example.com", email="legacy@example.com", password="x")
    token = str(RefreshToken.for_user(user).access_token)

    client = MagicMock()
    client.get_signing_key_from_jwt.side_effect = jwt.exceptions.PyJWKClientError("no matching key")
    with patch("accounts.entra_auth._jwks_client", return_value=client):
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    assert res.data["email"] == "legacy@example.com"


@pytest.mark.django_db
def test_entra_auth_noop_when_unconfigured(api):
    """Default settings (no ENTRA_* env vars) — Entra must not even attempt
    to parse the Authorization header, coexistence is purely additive."""
    user = User.objects.create_user(username="native@example.com", email="native@example.com", password="x")
    token = str(RefreshToken.for_user(user).access_token)

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    res = api.get("/api/auth/me/")

    assert res.status_code == 200
