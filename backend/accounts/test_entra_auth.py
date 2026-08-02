from unittest.mock import MagicMock, patch

import jwt
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

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
@override_settings(**ENTRA_SETTINGS, NEW_USER_NOTIFY_EMAIL="admin@example.com")
def test_new_user_provisioning_notifies_admin(api):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", return_value=CLAIMS),
        patch("accounts.notifications.send_mail") as send_mail,
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    send_mail.assert_called_once()
    subject, body, from_email, recipients = send_mail.call_args[0]
    assert recipients == ["admin@example.com"]
    assert CLAIMS["email"] in body


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS, NEW_USER_NOTIFY_EMAIL="admin@example.com")
def test_existing_user_login_does_not_notify_admin(api):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", return_value=CLAIMS),
        patch("accounts.notifications.send_mail") as send_mail,
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        api.get("/api/auth/me/")
        send_mail.reset_mock()
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    send_mail.assert_not_called()


@pytest.mark.django_db
@override_settings(**ENTRA_SETTINGS, NEW_USER_NOTIFY_EMAIL="admin@example.com")
def test_admin_notification_failure_does_not_block_sign_up(api):
    with (
        patch("accounts.entra_auth._jwks_client", return_value=_mock_jwks_client()),
        patch("accounts.entra_auth.jwt.decode", return_value=CLAIMS),
        patch("accounts.notifications.send_mail", side_effect=RuntimeError("mail down")),
        patch("accounts.notifications.sentry_sdk.capture_exception") as capture_exception,
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    assert User.objects.filter(entra_oid=CLAIMS["oid"]).exists()
    capture_exception.assert_called_once()


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
def test_token_not_resolvable_via_jwks_returns_401(api):
    """A token EntraJWTAuthentication can't even look up in JWKS (e.g.
    genuinely malformed, or from an unrelated issuer) must return None
    rather than raise — but since Entra is now the only authenticator,
    the request still ends up unauthenticated (401), not 403."""
    client = MagicMock()
    client.get_signing_key_from_jwt.side_effect = jwt.exceptions.PyJWKClientError("no matching key")
    with patch("accounts.entra_auth._jwks_client", return_value=client):
        api.credentials(HTTP_AUTHORIZATION="Bearer not-an-entra-token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401


@pytest.mark.django_db
def test_entra_auth_noop_when_unconfigured(api):
    """Default settings (no ENTRA_* env vars) — Entra must not attempt to
    parse the Authorization header, and the request is treated as
    unauthenticated rather than erroring."""
    api.credentials(HTTP_AUTHORIZATION="Bearer some.jwt.token")
    res = api.get("/api/auth/me/")

    assert res.status_code == 401
