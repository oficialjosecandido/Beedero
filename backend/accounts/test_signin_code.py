import re
import time
from unittest.mock import patch

import pytest
from django.core import mail
from firebase_admin import auth as firebase_auth
from rest_framework.test import APIClient

from accounts.signin_code import (
    CODE_TTL_SECONDS,
    MAX_ATTEMPTS,
    discard_code,
    issue_code,
    verify_code,
)

SEND_URL = "/api/auth/signin-link/"
VERIFY_URL = "/api/auth/signin-code/verify/"
STATE = "0123456789abcdef0123456789abcdef"
OOB = "1Rv0p_PqF6rJOpQOsaY5e6Xw0hFb-hdav12_wpQL1V0"
EMAIL = "someone@example.com"

FIREBASE_LINK = (
    "https://beedero-9356d.firebaseapp.com/__/auth/action"
    f"?apiKey=AIza-test&mode=signIn&oobCode={OOB}"
    "&continueUrl=https://beedero.com/api/auth/callback&lang=en"
)

# Same reason as test_signin_link.py: orgs.middleware opens a transaction on
# every request, before the view runs.
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def isolated_cache(settings):
    """Codes and throttles share the cache, so a leftover from one test would
    otherwise decide the next one."""
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


def send(api, email=EMAIL):
    return api.post(SEND_URL, {"email": email, "state": STATE, "next": "/feed"}, format="json")


def verify(api, code, email=EMAIL):
    return api.post(VERIFY_URL, {"email": email, "code": code}, format="json")


def code_from_outbox():
    """The code as a person reads it out of the email, not as the test made it."""
    match = re.search(r"^\s{4}(\d{6})$", mail.outbox[-1].body, re.MULTILINE)
    assert match, f"no code in email body:\n{mail.outbox[-1].body}"
    return match.group(1)


# --- the email -------------------------------------------------------------


def test_the_email_carries_a_code_as_well_as_a_link(api, firebase_mints):
    send(api)

    message = mail.outbox[0]
    code = code_from_outbox()
    for body in [message.body] + [alt for alt, _type in message.alternatives]:
        assert code in body
        # The link is still there — the code didn't replace it.
        assert "https://beedero.com/api/auth/callback?" in body
        assert "firebaseapp.com" not in body


def test_the_code_in_the_email_is_the_one_that_works(api, firebase_mints):
    send(api)

    res = verify(api, code_from_outbox())

    assert res.status_code == 200
    assert res.json()["oobCode"] == OOB


def test_asking_again_invalidates_the_previous_code(api, firebase_mints):
    send(api)
    first = code_from_outbox()
    send(api)
    second = code_from_outbox()

    assert first != second
    assert verify(api, first).status_code == 400
    assert verify(api, second).status_code == 200


def test_a_failed_send_leaves_no_usable_code_behind(api, firebase_mints):
    with patch(
        "accounts.signin_link.EmailMultiAlternatives.send", side_effect=RuntimeError("ACS down")
    ):
        assert send(api).status_code == 503

    assert verify(api, "000000").status_code == 400


def test_firebase_failing_does_not_burn_an_existing_code(api, firebase_mints):
    send(api)
    good = code_from_outbox()

    with patch.object(
        firebase_auth, "generate_sign_in_with_email_link", side_effect=ValueError("nope")
    ):
        assert send(api).status_code == 503

    # The code already sitting in the inbox still works: the failure happened
    # before anything replaced it.
    assert verify(api, good).status_code == 200


# --- the verify endpoint ---------------------------------------------------


def test_a_wrong_code_is_rejected_without_minting_anything(api, firebase_mints):
    send(api)
    wrong = "000000" if code_from_outbox() != "000000" else "111111"

    res = verify(api, wrong)

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_code"


def test_a_code_works_once(api, firebase_mints):
    send(api)
    code = code_from_outbox()

    assert verify(api, code).status_code == 200
    assert verify(api, code).status_code == 400


def test_five_wrong_guesses_kill_the_code(api, firebase_mints):
    send(api)
    code = code_from_outbox()
    wrong = "999999" if code != "999999" else "111111"

    for _ in range(MAX_ATTEMPTS):
        assert verify(api, wrong).status_code == 400

    # Even the right one, now.
    assert verify(api, code).status_code == 400


def test_a_never_issued_code_is_rejected_the_same_way(api, firebase_mints):
    res = verify(api, "123456", email="stranger@example.com")

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_code"


@pytest.mark.parametrize("bad", ["", "12345", "1234567", "12345a", "abcdef", " 123456 "])
def test_malformed_codes_are_rejected(api, firebase_mints, bad):
    send(api)

    res = verify(api, bad)

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_code"


def test_a_malformed_address_is_rejected_before_the_code_is_looked_at(api, firebase_mints):
    res = verify(api, "123456", email="not-an-email")

    assert res.status_code == 400
    assert res.json()["detail"] == "invalid_email"


def test_a_wrong_code_for_one_address_does_not_burn_anothers(api, firebase_mints):
    send(api, email="a@example.com")
    a_code = code_from_outbox()
    send(api, email="b@example.com")
    b_code = code_from_outbox()

    for _ in range(MAX_ATTEMPTS):
        verify(api, "000000", email="b@example.com")

    assert verify(api, a_code, email="a@example.com").status_code == 200
    assert verify(api, b_code, email="b@example.com").status_code == 400


def test_verify_needs_no_session(api, firebase_mints):
    # The global default is IsAuthenticated; a regression here locks everyone
    # out of the one endpoint they need before they have a session.
    send(api)

    assert verify(api, code_from_outbox()).status_code == 200


def test_firebase_refusing_at_verify_time_is_a_503_not_a_silent_400(api, firebase_mints):
    send(api)
    code = code_from_outbox()

    with patch("accounts.signin_link.get_firebase_app", return_value=None):
        res = verify(api, code)

    assert res.status_code == 503


def test_guesses_against_one_address_are_capped(api, firebase_mints):
    # Above the per-code budget: the throttle is what stops someone cycling
    # fresh codes to buy themselves more guesses.
    codes = [verify(api, "000000").status_code for _ in range(32)]

    assert codes.count(400) == 30
    assert codes[-1] == 429


# --- the code itself -------------------------------------------------------


def test_issued_codes_are_six_digits():
    assert re.fullmatch(r"\d{6}", issue_code(EMAIL))


def test_verify_consumes_the_code():
    code = issue_code(EMAIL)

    assert verify_code(EMAIL, code) is True
    assert verify_code(EMAIL, code) is False


def test_discard_makes_a_code_unusable():
    code = issue_code(EMAIL)
    discard_code(EMAIL)

    assert verify_code(EMAIL, code) is False


def test_a_wrong_guess_does_not_extend_the_window():
    """A code issued nine minutes ago must still die at ten, however many
    guesses land in between — otherwise guessing keeps it alive forever."""
    code = issue_code(EMAIL)
    near_expiry = time.time() + 30

    with patch("accounts.signin_code.time.time", return_value=near_expiry):
        assert verify_code(EMAIL, "000000") is False
        # Still inside the original window, so the real code still works.
        assert verify_code(EMAIL, code) is True

    code = issue_code(EMAIL)
    with patch("accounts.signin_code.time.time", return_value=time.time() + CODE_TTL_SECONDS + 1):
        assert verify_code(EMAIL, "000000") is False
        assert verify_code(EMAIL, code) is False


def test_codes_for_different_addresses_are_independent():
    a = issue_code("a@example.com")
    b = issue_code("b@example.com")

    # A code is only ever valid for the address it was issued to, even in the
    # freak case where two addresses draw the same six digits.
    assert verify_code("b@example.com", a) is (a == b)
    assert verify_code("a@example.com", a) is True
