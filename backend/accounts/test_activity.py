from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from django.db import DatabaseError
from django.utils import timezone
from firebase_admin import auth as firebase_auth
from rest_framework.test import APIClient

from accounts.activity import record_presence
from accounts.models import User
from analytics.models import UserActiveDay

UTC = ZoneInfo("UTC")
LISBON = ZoneInfo("Europe/Lisbon")
UID = "fIrEbAsEuId00000000000presence"
CLAIMS = {"uid": UID, "email": "seen@example.com", "email_verified": True}


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def firebase_configured():
    with patch("accounts.firebase_auth.get_firebase_app", return_value=object()):
        with patch.object(firebase_auth, "verify_id_token", return_value=CLAIMS):
            yield


@pytest.fixture
def person(db):
    return User.objects.create_user(username="p@example.com", email="p@example.com", password="x")


def _days(user):
    return list(UserActiveDay.objects.filter(user=user).order_by("day").values_list("day", "inferred"))


@pytest.mark.django_db
def test_authenticated_request_records_presence(api, firebase_configured):
    api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
    assert api.get("/api/auth/me/").status_code == 200

    user = User.objects.get(firebase_uid=UID)
    assert user.last_seen_at is not None
    assert _days(user) == [(timezone.localdate(user.last_seen_at, LISBON), False)]


@pytest.mark.django_db
def test_repeat_requests_within_the_hour_write_nothing(api, firebase_configured):
    api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
    api.get("/api/auth/me/")
    first_seen = User.objects.get(firebase_uid=UID).last_seen_at

    api.get("/api/auth/me/")
    api.get("/api/auth/me/")

    # Any write would have stamped a later time.
    assert User.objects.get(firebase_uid=UID).last_seen_at == first_seen
    assert UserActiveDay.objects.count() == 1


@pytest.mark.django_db
def test_anonymous_request_records_nothing(api, firebase_configured):
    api.get("/api/auth/me/")
    assert UserActiveDay.objects.count() == 0


@pytest.mark.django_db
def test_throttle_then_update_same_day(person):
    t0 = datetime(2026, 10, 19, 10, 0, tzinfo=LISBON)
    assert record_presence(person, at=t0) is True
    assert record_presence(person, at=t0 + timedelta(minutes=59)) is False
    assert record_presence(person, at=t0 + timedelta(minutes=61)) is True

    person.refresh_from_db()
    assert person.last_seen_at == t0 + timedelta(minutes=61)
    assert _days(person) == [(date(2026, 10, 19), False)]


@pytest.mark.django_db
def test_new_lisbon_day_is_recorded_even_inside_the_throttle(person):
    record_presence(person, at=datetime(2026, 10, 19, 23, 50, tzinfo=LISBON))
    # 15 minutes later, but past midnight in Lisbon.
    assert record_presence(person, at=datetime(2026, 10, 20, 0, 5, tzinfo=LISBON)) is True
    assert [d for d, _ in _days(person)] == [date(2026, 10, 19), date(2026, 10, 20)]


@pytest.mark.django_db
def test_day_boundary_is_lisbon_not_utc(person):
    # 23:30 UTC in summer is already 00:30 the next day in Lisbon (UTC+1).
    record_presence(person, at=datetime(2026, 7, 1, 23, 30, tzinfo=UTC))
    assert _days(person) == [(date(2026, 7, 2), False)]


@pytest.mark.django_db
def test_observation_upgrades_an_inferred_day(person):
    UserActiveDay.objects.create(user=person, day=date(2026, 10, 19), inferred=True)
    record_presence(person, at=datetime(2026, 10, 19, 9, 0, tzinfo=LISBON))
    assert _days(person) == [(date(2026, 10, 19), False)]


@pytest.mark.django_db
def test_database_error_never_breaks_sign_in(api, firebase_configured):
    with patch(
        "analytics.models.UserActiveDay.objects.bulk_create", side_effect=DatabaseError("boom")
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        res = api.get("/api/auth/me/")

    assert res.status_code == 200
    # The savepoint rolled back the whole presence write, not half of it.
    assert User.objects.get(firebase_uid=UID).last_seen_at is None
