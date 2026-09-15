from unittest.mock import patch

import pytest
from firebase_admin import auth as firebase_auth
from rest_framework.test import APIClient

from accounts.models import User

UID = "fIrEbAsEuId000000000000000001"
CLAIMS = {"uid": UID, "email": "new@example.com", "email_verified": True}


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def firebase_configured():
    """Stands in for a real service account. `authenticate()` only needs the
    app object to be non-None (it hands it to verify_id_token, which every
    test here patches)."""
    with patch("accounts.firebase_auth.get_firebase_app", return_value=object()):
        yield


def _verifies(claims=CLAIMS):
    return patch.object(firebase_auth, "verify_id_token", return_value=claims)


@pytest.mark.django_db
def test_valid_token_authenticates_and_provisions_once(api, firebase_configured):
    with _verifies():
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res1 = api.get("/api/auth/me/")
        res2 = api.get("/api/auth/me/")

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert User.objects.filter(firebase_uid=UID).count() == 1


@pytest.mark.django_db
def test_token_provisions_verified_email(api, firebase_configured):
    with _verifies():
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        api.get("/api/auth/me/")

    user = User.objects.get(firebase_uid=UID)
    assert user.email == CLAIMS["email"]
    assert user.is_email_verified


@pytest.mark.django_db
def test_firebase_sign_in_adopts_pre_cutover_row_by_verified_email(api, firebase_configured):
    """The whole point of the Entra -> Firebase cutover: an existing account
    keeps its profile, orgs and connections instead of becoming a duplicate."""
    legacy = User.objects.create(
        username="entra:legacy",
        email="New@Example.com",  # case differs on purpose
        entra_oid="11111111-1111-1111-1111-111111111111",
    )

    with _verifies():
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    legacy.refresh_from_db()
    assert legacy.firebase_uid == UID
    assert legacy.is_email_verified
    assert User.objects.count() == 1


@pytest.mark.django_db
def test_unverified_email_is_refused_outright(api, firebase_configured):
    """Email links always verify. An unverified token means the account came
    from the email/password provider, which Firebase forces on but Beedero
    doesn't use — no row, no session, no toehold on someone else's address."""
    legacy = User.objects.create(username="entra:legacy", email="new@example.com")

    with _verifies({**CLAIMS, "email_verified": False}):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401
    legacy.refresh_from_db()
    assert legacy.firebase_uid is None
    assert not User.objects.filter(firebase_uid=UID).exists()


@pytest.mark.django_db
def test_row_already_linked_to_another_uid_is_not_repointed(api, firebase_configured):
    """A shared/recycled address must not let a new Firebase identity hijack
    the account that claimed it first."""
    taken = User.objects.create(
        username="firebase:other", email="new@example.com", firebase_uid="someoneelse"
    )

    with _verifies():
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    taken.refresh_from_db()
    assert taken.firebase_uid == "someoneelse"
    assert User.objects.get(firebase_uid=UID).pk != taken.pk


@pytest.mark.django_db
def test_new_user_provisioning_notifies_admin(api, firebase_configured, settings):
    settings.NEW_USER_NOTIFY_EMAIL = "admin@example.com"
    with _verifies(), patch("accounts.notifications.send_mail") as send_mail:
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    send_mail.assert_called_once()
    _subject, body, _from_email, recipients = send_mail.call_args[0]
    assert recipients == ["admin@example.com"]
    assert CLAIMS["email"] in body


@pytest.mark.django_db
def test_existing_user_login_does_not_notify_admin(api, firebase_configured, settings):
    settings.NEW_USER_NOTIFY_EMAIL = "admin@example.com"
    with _verifies(), patch("accounts.notifications.send_mail") as send_mail:
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        api.get("/api/auth/me/")
        send_mail.reset_mock()
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    send_mail.assert_not_called()


@pytest.mark.django_db
def test_adopted_row_does_not_notify_admin(api, firebase_configured, settings):
    """An account that already existed under Entra isn't a new sign-up."""
    settings.NEW_USER_NOTIFY_EMAIL = "admin@example.com"
    User.objects.create(username="entra:legacy", email="new@example.com")

    with _verifies(), patch("accounts.notifications.send_mail") as send_mail:
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    send_mail.assert_not_called()


@pytest.mark.django_db
def test_admin_notification_failure_does_not_block_sign_up(api, firebase_configured, settings):
    settings.NEW_USER_NOTIFY_EMAIL = "admin@example.com"
    with (
        _verifies(),
        patch("accounts.notifications.send_mail", side_effect=RuntimeError("mail down")),
        patch("accounts.notifications.sentry_sdk.capture_exception") as capture_exception,
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    assert User.objects.filter(firebase_uid=UID).exists()
    capture_exception.assert_called_once()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "raised",
    [
        firebase_auth.ExpiredIdTokenError("expired", cause=None),
        firebase_auth.InvalidIdTokenError("bad signature"),
        firebase_auth.RevokedIdTokenError("revoked"),
        ValueError("not a JWT at all"),
    ],
)
def test_bad_token_returns_401(api, firebase_configured, raised):
    with patch.object(firebase_auth, "verify_id_token", side_effect=raised):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401


@pytest.mark.django_db
def test_token_without_uid_returns_401(api, firebase_configured):
    with _verifies({"email": "new@example.com", "email_verified": True}):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401
    assert not User.objects.exists()


@pytest.mark.django_db
def test_missing_bearer_header_is_anonymous_not_an_error(api, firebase_configured):
    res = api.get("/api/auth/me/")

    assert res.status_code == 401


@pytest.mark.django_db
def test_unconfigured_firebase_rejects_rather_than_failing_open(api):
    """No service account (the default in tests and CI): every token-bearing
    request is refused. Contrast notifications/push.py, which no-ops."""
    with patch("accounts.firebase_auth.get_firebase_app", return_value=None):
        api.credentials(HTTP_AUTHORIZATION="Bearer some.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 401
