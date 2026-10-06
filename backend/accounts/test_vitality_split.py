"""The three cards behind /api/investors/me/vitality/: the verification ladder
(what others confirmed), the posting cadence (a streak), and profile
completion (self-declared fields)."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.cadence import LISBON, posting_cadence
from accounts.completeness import WEIGHTS, profile_completion
from accounts.ladder import verification_ladder
from accounts.models import InvestorProfile, SelfDeclaredExperience, User
from affiliations.models import Affiliation, RoleType
from connections.models import Connection
from credibility.models import ProfessionalCredential
from orgs.models import Activity, Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def person(db):
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    return InvestorProfile.objects.create(
        user=user, full_name="Ada Lovelace", headline="Angel investor", country="GB"
    )


def rung(ladder: dict, key: str) -> dict:
    return next(item for item in ladder["rungs"] if item["key"] == key)


def post_at(user, moment) -> Activity:
    """A personal post (no org) created at `moment` — `created_at` is
    auto_now_add, so it has to be written back after the insert."""
    activity = Activity.objects.create(
        author=user, kind=Activity.Kind.UPDATE, title="Update", occurred_at=moment
    )
    Activity.objects.filter(pk=activity.pk).update(created_at=moment)
    activity.refresh_from_db()
    return activity


# --------------------------------------------------------------- the ladder


@pytest.mark.django_db
def test_fresh_profile_is_at_level_zero(person):
    ladder = verification_ladder(person)
    assert ladder["level"] == 0
    assert ladder["done_count"] == 0
    assert ladder["total_count"] == 7


@pytest.mark.django_db
def test_level_counts_only_consecutive_rungs(person):
    """Verified by Beedero without a confirmed email is done_count 1, level 0 —
    the ladder refuses to claim a height that was skipped."""
    person.is_verified = True
    person.save()
    ladder = verification_ladder(person)
    assert ladder["done_count"] == 1
    assert ladder["level"] == 0

    person.user.email_verified_at = timezone.now()
    person.user.save()
    assert verification_ladder(person)["level"] == 1


@pytest.mark.django_db
def test_credential_reaches_its_rung_without_any_organisation(person):
    """The point of the split: an independent professional climbs the ladder
    without ever belonging to an org."""
    ProfessionalCredential.objects.create(
        user=person.user,
        status=ProfessionalCredential.Status.VERIFIED,
        title="Psychotherapist",
        issuer="Ordem dos Psicólogos",
        identifier="12345",
        verified_at=timezone.now(),
    )
    credential_rung = rung(verification_ladder(person), "credential_verified")
    assert credential_rung["done"] is True
    assert credential_rung["attested_by"] == "Ordem dos Psicólogos"
    assert credential_rung["detail"] == "Psychotherapist · 12345"
    assert rung(verification_ladder(person), "role_confirmed")["done"] is False


@pytest.mark.django_db
def test_expiring_credential_warns_before_the_date(person):
    ProfessionalCredential.objects.create(
        user=person.user,
        status=ProfessionalCredential.Status.VERIFIED,
        title="Psychotherapist",
        issuer="Ordem dos Psicólogos",
        identifier="12345",
        verified_at=timezone.now(),
        valid_until=timezone.now() + timedelta(days=20),
    )
    assert "Expires in 20 days" in rung(verification_ladder(person), "credential_verified")["warning"]


@pytest.mark.django_db
def test_expired_credential_says_so(person):
    ProfessionalCredential.objects.create(
        user=person.user,
        status=ProfessionalCredential.Status.VERIFIED,
        title="Psychotherapist",
        issuer="Ordem dos Psicólogos",
        identifier="12345",
        verified_at=timezone.now(),
        valid_until=timezone.now() - timedelta(days=3),
    )
    assert "has expired" in rung(verification_ladder(person), "credential_verified")["warning"]


@pytest.mark.django_db
def test_registry_verified_founder_names_the_registry_as_attestor(person):
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    Affiliation.objects.create(
        user=person.user,
        org=org,
        role=RoleType.FOUNDER,
        title="Co-founder",
        started_on=date(2023, 1, 1),
        status=Affiliation.Status.VERIFIED,
        verified_via=Affiliation.VerifiedVia.REGISTRY,
        verified_at=timezone.now(),
        created_by=person.user,
    )
    role = rung(verification_ladder(person), "role_confirmed")
    assert role["done"] is True
    assert role["attested_by"] == "Company registry"
    assert role["detail"] == "Co-founder at Alma Labs"


@pytest.mark.django_db
def test_self_declared_experience_starts_the_record_but_confirms_nothing(person):
    SelfDeclaredExperience.objects.create(
        user=person.user, org_name="Somewhere", role="Engineer", started_on=date(2020, 1, 1)
    )
    ladder = verification_ladder(person)
    assert rung(ladder, "record_started")["done"] is True
    assert rung(ladder, "record_started")["attested_by"] == "You"
    assert rung(ladder, "role_confirmed")["done"] is False


@pytest.mark.django_db
def test_accepted_connection_is_its_own_rung(person):
    other = User.objects.create_user(username="bob", email="bob@example.com", password="x")
    first, second = sorted([person.user, other], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)
    connection_rung = rung(verification_ladder(person), "first_connection")
    assert connection_rung["done"] is True
    assert connection_rung["detail"] == "1 connection"


@pytest.mark.django_db
def test_handle_rung_shows_the_public_address(person):
    person.handle = "adalovelace"
    person.save()
    assert rung(verification_ladder(person), "public_address")["detail"] == "/p/adalovelace"


# -------------------------------------------------------------- the cadence


@pytest.mark.django_db
def test_no_posts_means_no_streak(person):
    cadence = posting_cadence(person.user)
    assert cadence["posted_this_week"] is False
    assert cadence["streak_weeks"] == 0
    assert cadence["last_post_at"] is None


@pytest.mark.django_db
def test_a_post_this_week_opens_a_streak(person):
    post_at(person.user, timezone.now())
    cadence = posting_cadence(person.user)
    assert cadence["posted_this_week"] is True
    assert cadence["streak_weeks"] == 1
    assert cadence["weeks_posted"] == 1


@pytest.mark.django_db
def test_consecutive_weeks_accumulate(person):
    now = timezone.now()
    for weeks_ago in range(4):
        post_at(person.user, now - timedelta(weeks=weeks_ago))
    cadence = posting_cadence(person.user)
    assert cadence["streak_weeks"] == 4
    assert cadence["best_streak_weeks"] == 4


@pytest.mark.django_db
def test_two_posts_in_one_week_are_one_week(person):
    now = timezone.now()
    monday = now - timedelta(days=now.astimezone(LISBON).weekday())
    post_at(person.user, monday)
    post_at(person.user, monday + timedelta(hours=2))
    assert posting_cadence(person.user)["weeks_posted"] == 1
    assert posting_cadence(person.user)["streak_weeks"] == 1


@pytest.mark.django_db
def test_streak_survives_a_week_that_has_not_ended_yet(person):
    """Monday morning must not wipe out a streak before the person has had any
    chance to post — the count runs from the last week that is over."""
    post_at(person.user, timezone.now() - timedelta(weeks=1))
    cadence = posting_cadence(person.user)
    assert cadence["posted_this_week"] is False
    assert cadence["streak_weeks"] == 1


@pytest.mark.django_db
def test_a_missed_week_breaks_the_streak_but_not_the_best(person):
    now = timezone.now()
    for weeks_ago in (3, 4, 5):
        post_at(person.user, now - timedelta(weeks=weeks_ago))
    cadence = posting_cadence(person.user)
    assert cadence["streak_weeks"] == 0
    assert cadence["best_streak_weeks"] == 3


@pytest.mark.django_db
def test_sunday_night_in_lisbon_counts_for_that_week(person):
    """23:30 Sunday Lisbon in summer is 22:30 UTC Sunday, but a naive UTC
    reading of a 00:30 Monday Lisbon post would move it into the next week."""
    sunday_late = datetime(2026, 7, 5, 23, 30, tzinfo=LISBON)  # a Sunday
    post_at(person.user, sunday_late)
    monday_early = datetime(2026, 7, 6, 0, 30, tzinfo=LISBON)  # the next Monday
    post_at(person.user, monday_early)
    cadence = posting_cadence(person.user)
    assert cadence["weeks_posted"] == 2
    assert cadence["best_streak_weeks"] == 2


@pytest.mark.django_db
def test_org_posts_do_not_count_as_personal_cadence(person):
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    activity = Activity.objects.create(
        org=org,
        author=person.user,
        kind=Activity.Kind.NEWS,
        title="Org news",
        occurred_at=timezone.now(),
    )
    assert activity.org_id is not None
    assert posting_cadence(person.user)["streak_weeks"] == 0


@pytest.mark.django_db
def test_days_left_is_within_the_week(person):
    days_left = posting_cadence(person.user)["days_left"]
    assert 1 <= days_left <= 7


@pytest.mark.django_db
def test_week_started_on_is_a_monday(person):
    started = date.fromisoformat(posting_cadence(person.user)["week_started_on"])
    assert started.weekday() == 0


# ----------------------------------------------------------- the completion


@pytest.mark.django_db
def test_completion_counts_only_self_declared_fields(person):
    completion = profile_completion(person)
    assert completion["total_count"] == 8
    assert completion["done_count"] == 3  # full_name, headline, country
    keys = {item["key"] for item in completion["items"]}
    assert "org_link" not in keys
    assert "first_post" not in keys


@pytest.mark.django_db
def test_completion_percent_follows_the_filled_fields(person):
    person.bio = "I build things."
    person.city = "Lisboa"
    person.skills = ["python"]
    person.links = [{"label": "Site", "url": "https://example.com"}]
    person.save()
    completion = profile_completion(person)
    assert completion["done_count"] == 7
    assert completion["percent"] == 88


@pytest.mark.django_db
def test_whitespace_is_not_a_filled_field(person):
    person.bio = "   "
    person.save()
    bio = next(item for item in profile_completion(person)["items"] if item["key"] == "bio")
    assert bio["done"] is False


@pytest.mark.django_db
def test_ranking_weights_are_untouched_by_the_split():
    """The discovery ranking reads WEIGHTS; the three new cards must not have
    moved anyone's search position."""
    assert WEIGHTS == {
        "full_name": 15,
        "headline": 15,
        "country": 15,
        "org_link": 30,
        "first_post": 25,
    }


# ------------------------------------------------------------- the endpoint


@pytest.mark.django_db
def test_vitality_endpoint_serves_all_three(api, person):
    api.force_authenticate(person.user)
    body = api.get("/api/investors/me/vitality/").json()
    assert body["ladder"]["total_count"] == 7
    assert body["cadence"]["streak_weeks"] == 0
    assert body["completion"]["total_count"] == 8
    # Still there for the onboarding wizard and the posting gate.
    assert "completeness" in body and "checklist" in body


@pytest.mark.django_db
def test_vitality_stays_private(api, person):
    other = User.objects.create_user(username="bob", email="bob@example.com", password="x")
    api.force_authenticate(other)
    body = api.get("/api/investors/me/vitality/").json()
    assert body["ladder"]["done_count"] == 0


@pytest.mark.django_db
def test_lisbon_is_the_cadence_calendar():
    assert LISBON == ZoneInfo("Europe/Lisbon")
