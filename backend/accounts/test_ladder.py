"""The verification ladder (accounts/ladder.py): eight rungs, the 50% gate on
rungs 1–4, and everything that reads the gate — Discover, suggestions,
connection requests and their daily limits."""

from datetime import date, datetime, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

# The Lisbon-day rule behind rung 8 lives with the cadence card, which uses
# the same calendar (accounts/cadence.py).
from accounts.cadence import LISBON, longest_daily_run
from accounts.ladder import (
    MIN_BIO_CHARS,
    discoverable,
    gate_state,
    is_unlocked,
    verification_ladder,
    with_unlock,
)
from accounts.models import InvestorProfile, SelfDeclaredExperience, User
from accounts.testing import unlock
from affiliations.models import Affiliation, RoleType
from connections.models import Connection, ConnectionRequest
from connections.services import daily_request_limit
from investments.models import InvestmentRecord
from notifications.models import Notification
from orgs.models import Activity, MembershipSkill, Organization, OrgMembership


@pytest.fixture
def api():
    return APIClient()


def make_user(username: str, *, email_verified: bool = True) -> User:
    user = User.objects.create_user(username=username, email=f"{username}@example.com", password="x")
    if email_verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at"])
    return user


def rung(ladder: dict, key: str) -> dict:
    return next(item for item in ladder["rungs"] if item["key"] == key)


def connect(a: User, b: User) -> None:
    first, second = sorted([a, b], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)


def post_on(user, moment) -> None:
    activity = Activity.objects.create(
        author=user, kind=Activity.Kind.UPDATE, title="Update", occurred_at=moment
    )
    Activity.objects.filter(pk=activity.pk).update(created_at=moment)


def listed(profile) -> bool:
    """What Discover, the suggestions and the advisor list all ask."""
    return discoverable(InvestorProfile.objects.filter(pk=profile.pk)).exists()


# ------------------------------------------------------------- the shape


@pytest.mark.django_db
def test_a_new_member_starts_on_rung_one():
    """Everyone signs in with an email link, so everyone starts at 1 of 8."""
    user = make_user("new")
    profile = InvestorProfile.objects.create(user=user)
    ladder = verification_ladder(profile)
    assert [r["key"] for r in ladder["rungs"]] == [
        "email_confirmed",
        "who_you_are",
        "face_and_story",
        "record_started",
        "first_connection",
        "confirmed",
        "beedero_verified",
        "daily_week",
    ]
    assert [r["band"] for r in ladder["rungs"]] == ["you"] * 4 + ["others"] * 3 + ["record"]
    assert ladder["done_count"] == 1
    assert ladder["percent"] == 12
    assert ladder["unlocked"] is False
    assert ladder["unlock_missing"] == ["who_you_are", "face_and_story", "record_started"]
    assert ladder["next"] == "who_you_are"


@pytest.mark.django_db
def test_the_four_you_rungs_are_fifty_percent_and_open_the_gate():
    profile = unlock(make_user("ana"))
    ladder = verification_ladder(profile)
    assert ladder["done_count"] == 4
    assert ladder["percent"] == 50
    assert ladder["unlocked"] is True
    assert ladder["unlock_missing"] == []
    assert ladder["next"] == "first_connection"
    assert is_unlocked(profile) is True
    assert listed(profile) is True
    assert gate_state(profile.user) == {"unlocked": True, "steps_left": 0}


@pytest.mark.django_db
def test_every_rung_done_is_a_hundred_percent():
    profile = unlock(make_user("ana"), is_verified=True)
    connect(profile.user, make_user("bob"))
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    Affiliation.objects.create(
        user=profile.user,
        org=org,
        role=RoleType.FOUNDER,
        started_on=date(2023, 1, 1),
        status=Affiliation.Status.VERIFIED,
        verified_via=Affiliation.VerifiedVia.ORG,
        verified_at=timezone.now(),
        created_by=profile.user,
    )
    today = timezone.now().astimezone(LISBON).replace(hour=12)
    for days_ago in range(7):
        post_on(profile.user, today - timedelta(days=days_ago))
    ladder = verification_ladder(profile)
    assert ladder["done_count"] == 8
    assert ladder["percent"] == 100
    assert ladder["next"] is None
    assert rung(ladder, "confirmed")["attested_by"] == "Alma Labs"


# ------------------------------------------- the gate: one rule, two forms


def _break_email(profile):
    profile.user.email_verified_at = None
    profile.user.save()


def _break_record(profile):
    profile.user.self_declared_experiences.all().delete()


BREAKERS = {
    "email not confirmed": _break_email,
    "no headline": lambda p: setattr(p, "headline", ""),
    "no country": lambda p: setattr(p, "country", ""),
    "no city": lambda p: setattr(p, "city", ""),
    "no photo": lambda p: setattr(p, "profile_picture", ""),
    "bio one short": lambda p: setattr(p, "bio", "x" * (MIN_BIO_CHARS - 1)),
    "bio padded with spaces": lambda p: setattr(p, "bio", "  " + "x" * (MIN_BIO_CHARS - 1) + "   "),
    "two skills": lambda p: setattr(p, "skills", ["Python", "SQL"]),
    "skills not a list": lambda p: setattr(p, "skills", {"a": 1, "b": 2, "c": 3}),
    "no role or degree": _break_record,
}


@pytest.mark.django_db
@pytest.mark.parametrize("why", list(BREAKERS))
def test_python_and_sql_agree_on_who_is_locked(why):
    profile = unlock(make_user("ana"))
    BREAKERS[why](profile)
    profile.save()
    profile.refresh_from_db()
    assert is_unlocked(profile) is False
    assert listed(profile) is False
    assert verification_ladder(profile)["unlocked"] is False
    assert gate_state(profile.user)["unlocked"] is False


@pytest.mark.django_db
def test_exactly_eighty_characters_is_enough():
    profile = unlock(make_user("ana"), bio="x" * MIN_BIO_CHARS)
    assert is_unlocked(profile) and listed(profile)


@pytest.mark.django_db
@pytest.mark.parametrize("route", ["affiliation", "membership"])
def test_an_org_role_also_starts_the_record(route):
    user = make_user("ana")
    profile = unlock(user)
    user.self_declared_experiences.all().delete()
    org = Organization.objects.create(name="Acme", slug="acme")
    if route == "affiliation":
        Affiliation.objects.create(
            user=user, org=org, role=RoleType.FOUNDER, started_on=date(2023, 1, 1), created_by=user
        )
    else:
        OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
    assert is_unlocked(profile) and listed(profile)


def _bare_record(username: str):
    """A person past rungs 1–3 with a role on file and not one skill anywhere."""
    user = make_user(username)
    profile = unlock(user)
    profile.skills = []
    profile.save()
    user.self_declared_experiences.all().delete()
    org = Organization.objects.create(name="Acme", slug="acme")
    membership = OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
    experience = SelfDeclaredExperience.objects.create(
        user=user, org_name="Acme", role="Founder", started_on=date(2024, 1, 1)
    )
    return profile, experience, membership


@pytest.mark.django_db
@pytest.mark.parametrize("store", ["profile", "experience", "roster", "spread"])
def test_three_skills_start_the_record_wherever_they_were_typed(store):
    """Add experience writes skills onto the experience, not onto the profile's
    cloud, so a gate that read only the cloud told people who had just filled
    in their whole professional record that they had declared no skills."""
    profile, experience, membership = _bare_record("ana")
    if store == "profile":
        profile.skills = ["Python", "React", "SQL"]
        profile.save()
    elif store == "experience":
        experience.skills = ["Python", "React", "SQL"]
        experience.save(update_fields=["skills"])
    elif store == "roster":
        for skill in ("Python", "React", "SQL"):
            MembershipSkill.objects.create(membership=membership, skill=skill)
    else:
        profile.skills = ["Python"]
        profile.save()
        experience.skills = ["React"]
        experience.save(update_fields=["skills"])
        MembershipSkill.objects.create(membership=membership, skill="SQL")

    profile.refresh_from_db()
    assert rung(verification_ladder(profile), "record_started")["done"] is True
    # Both engines, or Discover and the ladder would tell the person different
    # things about the same profile.
    assert is_unlocked(profile) and listed(profile)


@pytest.mark.django_db
def test_skills_add_up_across_several_experiences():
    """Two skills on each of two roles is four. The SQL half of the gate sums
    them in a subquery, which would happily return only the first row."""
    profile, experience, _ = _bare_record("ana")
    experience.skills = ["Python", "React"]
    experience.save(update_fields=["skills"])
    SelfDeclaredExperience.objects.create(
        user=profile.user,
        org_name="Beedero",
        role="Founder",
        started_on=date(2025, 5, 1),
        skills=["SQL", "Django"],
    )

    profile.refresh_from_db()
    assert rung(verification_ladder(profile), "record_started")["done"] is True
    assert is_unlocked(profile) and listed(profile)


@pytest.mark.django_db
def test_two_skills_across_the_stores_are_still_two():
    profile, experience, _ = _bare_record("ana")
    profile.skills = ["Python"]
    profile.save()
    experience.skills = ["React"]
    experience.save(update_fields=["skills"])

    profile.refresh_from_db()
    assert rung(verification_ladder(profile), "record_started")["done"] is False
    assert is_unlocked(profile) is False
    assert listed(profile) is False


@pytest.mark.django_db
def test_fifty_percent_from_the_wrong_rungs_does_not_unlock():
    """Email + three rungs that need others: 4 of 8, but an empty profile must
    not show up in Discover."""
    user = make_user("ana")
    profile = InvestorProfile.objects.create(user=user, full_name="Ana", is_verified=True)
    connect(user, make_user("bob"))
    today = timezone.now().astimezone(LISBON).replace(hour=12)
    for days_ago in range(7):
        post_on(user, today - timedelta(days=days_ago))
    ladder = verification_ladder(profile)
    assert ladder["percent"] == 50
    assert ladder["unlocked"] is False
    assert listed(profile) is False


@pytest.mark.django_db
def test_an_internal_account_is_kept_out_of_the_lists_only():
    """Team logins and fixtures (the `lighthouse-demo` person) must not pad a
    list of people to connect with. Everything else they keep: the gate itself
    still opens for them, so they can ask to connect like anyone."""
    profile = unlock(make_user("fixture"))
    assert listed(profile) is True

    profile.user.is_internal = True
    profile.user.save(update_fields=["is_internal"])
    assert listed(profile) is False
    assert is_unlocked(profile) is True
    assert with_unlock(InvestorProfile.objects.filter(pk=profile.pk)).exists()


@pytest.mark.django_db
def test_steps_left_counts_only_the_gate():
    user = make_user("ana")
    assert gate_state(user) == {"unlocked": False, "steps_left": 3}  # no profile yet
    InvestorProfile.objects.create(user=user, full_name="Ana", headline="Builder")
    assert gate_state(user)["steps_left"] == 3


# ----------------------------------------------------------- rungs 5–8


@pytest.mark.django_db
def test_a_confirmed_investment_confirms_the_investor():
    profile = unlock(make_user("ana"))
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    InvestmentRecord.objects.create(
        org=org,
        investor_user=profile.user,
        amount_cents=5_000_000,
        invested_on=date(2024, 5, 1),
        status=InvestmentRecord.Status.CONFIRMED,
        declarer_side="investor",
        confirmed_at=timezone.now(),
    )
    confirmed = rung(verification_ladder(profile), "confirmed")
    assert confirmed["done"] is True
    assert confirmed["attested_by"] == "Alma Labs"


@pytest.mark.django_db
def test_a_declared_investment_confirms_nothing():
    profile = unlock(make_user("ana"))
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    InvestmentRecord.objects.create(
        org=org,
        investor_user=profile.user,
        amount_cents=5_000_000,
        invested_on=date(2024, 5, 1),
        declarer_side="investor",
    )
    assert rung(verification_ladder(profile), "confirmed")["done"] is False


@pytest.mark.django_db
def test_a_roster_row_an_admin_confirmed_confirms_the_person():
    profile = unlock(make_user("ana"))
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    OrgMembership.objects.create(
        org=org,
        user=profile.user,
        role=OrgMembership.Role.MEMBER,
        title="Engineer",
        details_confirmed_by=make_user("admin"),
        details_confirmed_at=timezone.now(),
    )
    confirmed = rung(verification_ladder(profile), "confirmed")
    assert confirmed["done"] is True
    assert confirmed["attested_by"] == "Alma Labs"
    assert confirmed["detail"] == "Engineer at Alma Labs"


@pytest.mark.django_db
@pytest.mark.parametrize("confirmer", ["self", "nobody"])
def test_a_roster_row_nobody_else_vouched_for_confirms_nothing(confirmer):
    """Creating an org hands you a confirmed row on your own roster, and rows
    that predate the confirmer column have no attester we can name. Neither is
    somebody else vouching for you."""
    profile = unlock(make_user("ana"))
    org = Organization.objects.create(name="Alma Labs", slug="alma-labs")
    OrgMembership.objects.create(
        org=org,
        user=profile.user,
        role=OrgMembership.Role.OWNER,
        details_confirmed_by=profile.user if confirmer == "self" else None,
        details_confirmed_at=timezone.now() if confirmer == "self" else None,
    )
    assert rung(verification_ladder(profile), "confirmed")["done"] is False


@pytest.mark.django_db
def test_seven_days_in_a_row_climb_the_last_rung():
    profile = unlock(make_user("ana"))
    start = datetime(2026, 9, 1, 9, 0, tzinfo=LISBON)
    for day in range(6):
        post_on(profile.user, start + timedelta(days=day))
    last = rung(verification_ladder(profile), "daily_week")
    assert last["done"] is False
    assert last["progress"] == 6

    post_on(profile.user, start + timedelta(days=6))
    last = rung(verification_ladder(profile), "daily_week")
    assert last["done"] is True
    assert last["progress"] == 7


@pytest.mark.django_db
def test_a_missed_day_restarts_the_run_and_two_posts_a_day_count_once():
    user = make_user("ana")
    start = datetime(2026, 9, 1, 9, 0, tzinfo=LISBON)
    for day in (0, 1, 2, 4, 5, 6, 7, 8):  # day 3 missed
        post_on(user, start + timedelta(days=day))
        post_on(user, start + timedelta(days=day, hours=5))
    assert longest_daily_run(user) == 5


@pytest.mark.django_db
def test_days_are_lisbon_days():
    """23:50 and 00:10 Lisbon in summer fall on the same UTC date — but they
    are two days for the person posting them."""
    user = make_user("ana")
    post_on(user, datetime(2026, 7, 5, 23, 50, tzinfo=LISBON))
    post_on(user, datetime(2026, 7, 6, 0, 10, tzinfo=LISBON))
    assert longest_daily_run(user) == 2


@pytest.mark.django_db
def test_org_posts_do_not_count_for_the_daily_week():
    user = make_user("ana")
    org = Organization.objects.create(name="Acme", slug="acme")
    start = datetime(2026, 9, 1, 9, 0, tzinfo=LISBON)
    for day in range(7):
        activity = Activity.objects.create(
            org=org, author=user, kind=Activity.Kind.NEWS, title="News", occurred_at=start
        )
        Activity.objects.filter(pk=activity.pk).update(created_at=start + timedelta(days=day))
    assert longest_daily_run(user) == 0


@pytest.mark.django_db
def test_the_daily_week_stays_once_climbed():
    """It records something that happened; the weekly cadence card is what asks
    for it to keep happening."""
    user = make_user("ana")
    long_ago = datetime(2025, 1, 6, 9, 0, tzinfo=LISBON)
    for day in range(7):
        post_on(user, long_ago + timedelta(days=day))
    assert longest_daily_run(user) == 7


# ------------------------------------------------------- what the gate opens


@pytest.mark.django_db
def test_people_below_the_gate_are_not_suggested_in_the_feed(api):
    viewer = unlock(make_user("viewer")).user
    ready = unlock(make_user("ready"))
    InvestorProfile.objects.create(user=make_user("half"), full_name="Half Done", headline="Builder")
    api.force_authenticate(viewer)
    people = api.get("/api/recommendations/").json()["people"]
    assert [p["id"] for p in people] == [ready.user_id]


@pytest.mark.django_db
def test_a_locked_member_cannot_send_but_can_accept(api):
    locked = make_user("locked")
    InvestorProfile.objects.create(user=locked, full_name="Lou Locked", headline="Builder")
    ready = unlock(make_user("ready")).user

    api.force_authenticate(locked)
    response = api.post("/api/connections/requests/", {"recipient_id": ready.id}, format="json")
    assert response.status_code == 403
    assert response.json()["code"] == "profile_locked"
    assert not ConnectionRequest.objects.exists()

    api.force_authenticate(ready)
    sent = api.post("/api/connections/requests/", {"recipient_id": locked.id}, format="json")
    assert sent.status_code == 201

    api.force_authenticate(locked)
    request_id = ConnectionRequest.objects.get().id
    accepted = api.post(f"/api/connections/requests/{request_id}/accept/")
    assert accepted.status_code in (200, 201)
    assert Connection.objects.count() == 1


@pytest.mark.django_db
def test_the_public_profile_tells_the_viewer_whether_they_can_ask(api):
    subject = unlock(make_user("subject"))
    viewer = make_user("viewer")
    InvestorProfile.objects.create(user=viewer, full_name="Vee")
    api.force_authenticate(viewer)
    actions = api.get(f"/api/public/people/{subject.handle}/").json()["viewer_actions"]
    assert actions["can_request"] is False

    unlock(viewer)
    api.force_authenticate(User.objects.get(pk=viewer.pk))  # a request loads a fresh user
    actions = api.get(f"/api/public/people/{subject.handle}/").json()["viewer_actions"]
    assert actions["can_request"] is True


@pytest.mark.django_db
def test_discover_tells_the_viewer_whether_they_are_listed(api):
    viewer = make_user("viewer")
    InvestorProfile.objects.create(user=viewer, full_name="Vee", headline="Builder")
    api.force_authenticate(viewer)
    body = api.get("/api/discovery/people/").json()
    assert body["viewer"] == {"unlocked": False, "steps_left": 3}


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("climb", "limit"),
    [("locked", 0), ("unlocked", 5), ("connected", 10), ("confirmed", 20), ("beedero", 50)],
)
def test_daily_request_limit_grows_with_the_ladder(climb, limit):
    user = make_user("ana")
    if climb == "locked":
        InvestorProfile.objects.create(user=user, full_name="Ana")
        assert daily_request_limit(user) == limit
        return
    profile = unlock(user, is_verified=(climb == "beedero"))
    if climb == "connected":
        connect(user, make_user("bob"))
    if climb == "confirmed":
        org = Organization.objects.create(name="Acme", slug="acme")
        Affiliation.objects.create(
            user=user,
            org=org,
            role=RoleType.FOUNDER,
            started_on=date(2023, 1, 1),
            status=Affiliation.Status.VERIFIED,
            verified_via=Affiliation.VerifiedVia.REGISTRY,
            verified_at=timezone.now(),
            created_by=user,
        )
    profile.refresh_from_db()
    assert daily_request_limit(user) == limit


# ---------------------------------------------------- the moment it opens


@pytest.mark.django_db
def test_unlocking_is_stamped_and_announced_once(api):
    profile = unlock(make_user("ana"))
    api.force_authenticate(profile.user)

    api.get("/api/investors/me/vitality/")
    profile.refresh_from_db()
    first = profile.discoverable_since
    assert first is not None
    assert Notification.objects.filter(user=profile.user, title="You're in Discover").count() == 1

    api.get("/api/investors/me/vitality/")
    profile.refresh_from_db()
    assert profile.discoverable_since == first
    assert Notification.objects.filter(user=profile.user, title="You're in Discover").count() == 1


@pytest.mark.django_db
def test_a_locked_profile_is_not_stamped(api):
    user = make_user("ana")
    InvestorProfile.objects.create(user=user, full_name="Ana")
    api.force_authenticate(user)
    api.get("/api/investors/me/vitality/")
    assert InvestorProfile.objects.get(user=user).discoverable_since is None
    assert not Notification.objects.filter(user=user).exists()
