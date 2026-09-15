from unittest.mock import patch

import pytest
from django.core import mail
from firebase_admin import auth as firebase_auth
from rest_framework.test import APIClient

from accounts.signin_link import SignInLinkUnavailable, safe_next_path

URL = "/api/auth/signin-link/"
STATE = "0123456789abcdef0123456789abcdef"
OOB = "1Rv0p_PqF6rJOpQOsaY5e6Xw0hFb-hdav12_wpQL1V0"

# What generate_sign_in_with_email_link() actually returns: the action-handler
# link, which this code mines for the oobCode and then throws away.
FIREBASE_LINK = (
    "https://beedero-9356d.firebaseapp.com/__/auth/action"
    f"?apiKey=AIza-test&mode=signIn&oobCode={OOB}"
    "&continueUrl=https://beedero.com/api/auth/callback&lang=en"
)


# Every request here passes through orgs.middleware, which opens a transaction
# before the view is ever reached.
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def isolated_throttle_cache(settings):
    """The view is throttled, so without this the fifth test to use one address
    would start getting 429s from the fourth one's leftovers."""
    settings.CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    }
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.FRONTEND_URL = "https://beedero.com"
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def firebase_mints():
    with patch("accounts.signin_link.get_firebase_app", return_value=object()), patch.object(
        firebase_auth, "generate_sign_in_with_email_link", return_value=FIREBASE_LINK
    ) as minted:
        yield minted


def post(api, **overrides):
    body = {"email": "someone@example.com", "state": STATE, "next": "/feed"}
    body.update(overrides)
    return api.post(URL, body, format="json")


def test_sends_one_branded_email_with_our_own_link(api, firebase_mints):
    res = post(api, next="/orgs/acme")

    assert res.status_code == 204
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["someone@example.com"]
    assert message.subject == "Sign in to Beedero"

    bodies = [message.body] + [alt for alt, _type in message.alternatives]
    for body in bodies:
        assert "https://beedero.com/api/auth/callback?" in body
        assert f"oobCode={OOB}" in body
        assert "mode=signIn" in body
        assert f"state={STATE}" in body
        assert "next=%2Forgs%2Facme" in body
        # The whole point of the change: no Firebase-branded URL survives into
        # what the recipient sees.
        assert "firebaseapp.com" not in body


def test_continue_url_handed_to_firebase_is_ours(api, firebase_mints):
    post(api)

    settings_arg = firebase_mints.call_args.args[1]
    assert settings_arg.url.startswith("https://beedero.com/api/auth/callback?")
    assert settings_arg.handle_code_in_app is True


def test_reply_is_identical_for_an_address_with_no_account(api, firebase_mints):
    known = post(api, email="member@example.com")
    unknown = post(api, email="nobody@example.com")

    assert known.status_code == unknown.status_code == 204
    assert known.content == unknown.content


def test_offsite_next_falls_back_rather_than_travelling_in_the_link(api, firebase_mints):
    post(api, next="//evil.com/phish")

    assert "next=%2Ffeed" in mail.outbox[0].body
    assert "evil.com" not in mail.outbox[0].body


@pytest.mark.parametrize("bad", ["", "not-an-email", "a@b", "x" * 250 + "@example.com"])
def test_malformed_address_is_rejected_without_sending(api, firebase_mints, bad):
    res = post(api, email=bad)

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_email"
    assert mail.outbox == []


@pytest.mark.parametrize("bad", ["", "short", "../../etc", "0123456789abcdef0123456789abcdeZ"])
def test_malformed_state_is_rejected_without_sending(api, firebase_mints, bad):
    res = post(api, state=bad)

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_state"
    assert mail.outbox == []


def test_no_service_account_is_an_operator_error_not_a_silent_success(api):
    with patch("accounts.signin_link.get_firebase_app", return_value=None):
        res = post(api)

    assert res.status_code == 503
    assert mail.outbox == []


def test_firebase_refusing_surfaces_as_503(api):
    with patch("accounts.signin_link.get_firebase_app", return_value=object()), patch.object(
        firebase_auth, "generate_sign_in_with_email_link", side_effect=ValueError("nope")
    ):
        res = post(api)

    assert res.status_code == 503
    assert mail.outbox == []


def test_a_link_without_an_oobcode_is_never_emailed(api):
    with patch("accounts.signin_link.get_firebase_app", return_value=object()), patch.object(
        firebase_auth,
        "generate_sign_in_with_email_link",
        return_value="https://beedero-9356d.firebaseapp.com/__/auth/action?mode=signIn",
    ):
        res = post(api)

    assert res.status_code == 503
    assert mail.outbox == []


def test_a_failed_send_is_reported_rather_than_swallowed(api, firebase_mints):
    with patch(
        "accounts.signin_link.EmailMultiAlternatives.send", side_effect=RuntimeError("ACS down")
    ):
        res = post(api)

    assert res.status_code == 503


def test_one_address_cannot_be_mailed_without_limit(api, firebase_mints):
    codes = [post(api, email="target@example.com").status_code for _ in range(7)]

    assert codes.count(204) == 5
    assert codes[-1] == 429
    assert len(mail.outbox) == 5


def test_the_per_address_limit_does_not_block_a_different_address(api, firebase_mints):
    for _ in range(5):
        post(api, email="target@example.com")

    assert post(api, email="other@example.com").status_code == 204


def test_one_source_cannot_spray_a_list(api, firebase_mints):
    codes = [post(api, email=f"user{i}@example.com").status_code for i in range(22)]

    assert codes.count(204) == 20
    assert codes[-1] == 429


def test_endpoint_needs_no_session(api, firebase_mints):
    # No credentials set, and the global default is IsAuthenticated — a
    # regression here locks everyone out of signing in.
    assert post(api).status_code == 204


@pytest.mark.parametrize(
    "value,expected",
    [
        ("/feed", "/feed"),
        ("/orgs/acme", "/orgs/acme"),
        ("//evil.com", "/feed"),
        ("https://evil.com", "/feed"),
        ("", "/feed"),
        (None, "/feed"),
    ],
)
def test_safe_next_path(value, expected):
    assert safe_next_path(value) == expected


def test_unavailable_is_its_own_exception_type():
    assert issubclass(SignInLinkUnavailable, Exception)
