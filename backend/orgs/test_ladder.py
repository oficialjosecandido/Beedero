"""The organisation's verification ladder (orgs/ladder.py): eight rungs, the
50% gate on rungs 1–4, and everything that reads the gate — publishing,
Discover, suggestions and investor alerts."""

from datetime import date, datetime, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from accounts.testing import unlock
from affiliations.models import Affiliation, RoleType
from credibility.models import Verification, VerificationType
from notifications.management.commands.send_investor_alerts import matching_orgs_for
from orgs.constants import SectionKind
from orgs.ladder import (
    LISBON,
    gate_missing,
    is_org_unlocked,
    listed_in_discover,
    longest_daily_run,
    org_verification_ladder,
    with_org_unlock,
)
from orgs.models import Activity, OrgField, Organization, OrgMembership, OrgSection
from orgs.testing import unlock_org
from billing.testing import grant_plan


@pytest.fixture
def api():
    return APIClient()


def make_user(username: str, *, email_verified: bool = True) -> User:
    user = User.objects.create_user(username=username, email=f"{username}@example.com", password="x")
    if email_verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at"])
    return user


def make_org(owner: User, slug: str = "acme", **fields) -> Organization:
    from billing.testing import grant_plan

    org = Organization.objects.create(slug=slug, name=fields.pop("name", slug.title()), **fields)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    grant_plan(org)
    return org


def rung(ladder: dict, key: str) -> dict:
    return next(item for item in ladder["rungs"] if item["key"] == key)


def gated(org) -> bool:
    return with_org_unlock(Organization.objects.filter(pk=org.pk)).exists()


def post_on(org, moment) -> None:
    activity = Activity.objects.create(org=org, kind=Activity.Kind.NEWS, title="News", occurred_at=moment)
    Activity.objects.filter(pk=activity.pk).update(created_at=moment)


def registry(org, *, status=Verification.Status.VERIFIED, valid_until=None, reason="") -> Verification:
    return Verification.objects.create(
        org=org,
        type=VerificationType.COMPANY_REGISTRY,
        status=status,
        payload={"nif": "503504564", "access_code": "1234-5678-9012"},
        valid_until=valid_until,
        rejection_reason=reason,
    )


# ------------------------------------------------------------- the shape


@pytest.mark.django_db
def test_a_new_organisation_starts_on_rung_one():
    """Organisations are created by signed-in people, so every one starts at 1 of 8."""
    org = make_org(make_user("ana"))
    ladder = org_verification_ladder(org)
    assert [r["key"] for r in ladder["rungs"]] == [
        "owner_confirmed",
        "who_you_are",
        "what_you_do",
        "face_behind_it",
        "team_confirmed",
        "registry_confirmed",
        "beedero_verified",
        "daily_week",
    ]
    assert [r["band"] for r in ladder["rungs"]] == ["team"] * 4 + ["others"] * 3 + ["record"]
    assert ladder["done_count"] == 1
    assert ladder["percent"] == 12
    assert ladder["unlocked"] is False
    assert ladder["unlock_missing"] == ["who_you_are", "what_you_do", "face_behind_it"]
    assert ladder["can_publish"] is False
    assert ladder["listed"] is False


@pytest.mark.django_db
def test_the_four_team_rungs_are_fifty_percent_and_allow_publishing():
    org = unlock_org(make_org(make_user("ana")))
    ladder = org_verification_ladder(org)
    assert ladder["done_count"] == 4
    assert ladder["percent"] == 50
    assert ladder["unlocked"] is True
    assert ladder["can_publish"] is True
    assert ladder["listed"] is False  # still a draft
    assert is_org_unlocked(org) and gated(org)
    assert gate_missing(org) == []
    assert ladder["next"] == "team_confirmed"


@pytest.mark.django_db
def test_the_face_behind_it_names_the_person():
    owner = make_user("ana")
    org = unlock_org(make_org(owner), person=owner)
    owner.investorprofile.full_name = "Ana Silva"
    owner.investorprofile.save()
    face = rung(org_verification_ladder(org), "face_behind_it")
    assert face["done"] is True
    assert face["detail"] == "Ana Silva"


# ------------------------------------------- the gate: one rule, two forms


def _unconfirmed_owner(org):
    # The owner left is Ana, whose email is unconfirmed; the founder with a
    # confirmed one becomes a plain member.
    OrgMembership.objects.filter(org=org, user__username="ladder-founder").update(
        role=OrgMembership.Role.MEMBER
    )


def _drop_about_key(org):
    OrgField.objects.filter(section__org=org, section__kind=SectionKind.ABOUT, key="vision").delete()


def _archive_about(org):
    OrgSection.objects.filter(org=org, kind=SectionKind.ABOUT).update(archived_at=timezone.now())


def _drop_products(org):
    OrgField.objects.filter(section__org=org, section__kind=SectionKind.PRODUCTS).delete()


def _lock_the_only_face(org):
    InvestorProfile.objects.filter(user__username="ladder-founder").update(profile_picture="")


def _remove_the_only_face(org):
    OrgMembership.objects.filter(org=org, user__username="ladder-founder").delete()


BREAKERS = {
    "only a plain member has a confirmed email": _unconfirmed_owner,
    "no logo": lambda org: Organization.objects.filter(pk=org.pk).update(logo=""),
    "no one-liner": lambda org: Organization.objects.filter(pk=org.pk).update(one_liner=""),
    "no stage": lambda org: Organization.objects.filter(pk=org.pk).update(stage=""),
    "no sector": lambda org: Organization.objects.filter(pk=org.pk).update(sector=""),
    "no base": lambda org: Organization.objects.filter(pk=org.pk).update(geo=""),
    "About without a vision": _drop_about_key,
    "About archived": _archive_about,
    "no product": _drop_products,
    "the only face below their own gate": _lock_the_only_face,
    "the only face left the team": _remove_the_only_face,
}


@pytest.mark.django_db
@pytest.mark.parametrize("why", list(BREAKERS))
def test_python_and_sql_agree_on_which_organisations_are_locked(why):
    owner = make_user("ana", email_verified=False)
    org = make_org(owner)
    unlock_org(org)  # the shared founder joins as an owner with a confirmed email
    assert is_org_unlocked(org) and gated(org)

    BREAKERS[why](org)
    org.refresh_from_db()
    assert is_org_unlocked(org) is False
    assert gated(org) is False
    assert org_verification_ladder(org)["unlocked"] is False


@pytest.mark.django_db
def test_an_admin_with_a_confirmed_email_is_enough_for_rung_one():
    owner = make_user("ana", email_verified=False)
    org = make_org(owner)
    admin = make_user("bob")
    OrgMembership.objects.create(org=org, user=admin, role=OrgMembership.Role.ADMIN)
    assert rung(org_verification_ladder(org), "owner_confirmed")["done"] is True


@pytest.mark.django_db
def test_fifty_percent_from_the_wrong_rungs_does_not_unlock():
    """Owner + three confirmations from others: 4 of 8, but no logo, no About
    and no face — it must not be publishable."""
    owner = make_user("ana")
    org = make_org(owner, is_verified=True)
    person = make_user("bob")
    Affiliation.objects.create(
        user=person,
        org=org,
        role=RoleType.EMPLOYEE,
        started_on=date(2024, 1, 1),
        status=Affiliation.Status.VERIFIED,
        verified_via=Affiliation.VerifiedVia.ORG,
        verified_at=timezone.now(),
        created_by=person,
    )
    registry(org)
    ladder = org_verification_ladder(org)
    assert ladder["percent"] == 50
    assert ladder["unlocked"] is False
    assert ladder["can_publish"] is False
    assert gated(org) is False


# ------------------------------------------------------------- publishing


@pytest.mark.django_db
def test_publishing_needs_the_gate_and_stamps_the_moment(api):
    owner = make_user("ana")
    api.force_authenticate(owner)
    slug = api.post(
        "/api/org-onboarding/",
        {"name": "Acme", "one_liner": "We build things", "accept_terms": True},
        format="json",
    ).data["slug"]
    org = Organization.objects.get(slug=slug)
    assert api.post(f"/api/orgs/{slug}/activate/").status_code == 402  # no plan yet
    grant_plan(org)

    refused = api.post(f"/api/orgs/{slug}/activate/")
    assert refused.status_code == 400
    assert refused.data["missing"] == ["who_you_are", "what_you_do", "face_behind_it"]

    unlock_org(org, person=owner)
    published = api.post(f"/api/orgs/{slug}/activate/")
    assert published.status_code == 200
    org.refresh_from_db()
    assert org.status == Organization.Status.LIVE
    assert org.discoverable_since is not None
    assert org_verification_ladder(org)["listed"] is True


@pytest.mark.django_db
def test_the_onboarding_endpoint_serves_the_ladder_to_members(api):
    owner = make_user("ana")
    org = make_org(owner)
    member = make_user("bob")
    OrgMembership.objects.create(org=org, user=member, role=OrgMembership.Role.MEMBER)
    api.force_authenticate(member)
    body = api.get(f"/api/orgs/{org.slug}/onboarding/").json()
    assert body["ladder"]["total_count"] == 8
    assert body["publish_ready"] is body["ladder"]["unlocked"] is False


# ---------------------------------------------------------- what is listed


@pytest.mark.django_db
def test_discover_lists_only_live_organisations_past_the_gate(api):
    viewer = make_user("viewer")
    ready = unlock_org(make_org(make_user("ana"), slug="ready", status=Organization.Status.LIVE))
    make_org(make_user("bob"), slug="bare", status=Organization.Status.LIVE)
    unlock_org(make_org(make_user("cy"), slug="draft"))
    api.force_authenticate(viewer)
    slugs = [item["slug"] for item in api.get("/api/discovery/").json()["items"]]
    assert slugs == [ready.slug]
    public = [item["slug"] for item in api.get("/api/public/discovery/").json()["items"]]
    assert public == [ready.slug]


@pytest.mark.django_db
def test_dropping_below_the_gate_hides_from_discover_but_keeps_the_page(api):
    org = unlock_org(make_org(make_user("ana"), status=Organization.Status.LIVE))
    assert list(listed_in_discover(Organization.objects.all())) == [org]

    _lock_the_only_face(org)
    assert list(listed_in_discover(Organization.objects.all())) == []
    assert api.get(f"/api/public/orgs/{org.slug}/").status_code == 200


@pytest.mark.django_db
def test_suggestions_only_offer_listed_organisations(api):
    viewer = make_user("viewer")
    unlock(viewer)
    ready = unlock_org(make_org(make_user("ana"), slug="ready", status=Organization.Status.LIVE))
    make_org(make_user("bob"), slug="bare", status=Organization.Status.LIVE)
    api.force_authenticate(viewer)
    feed = [org["slug"] for org in api.get("/api/recommendations/").json()["organizations"]]
    assert ready.slug in feed and "bare" not in feed
    onboarding = [org["slug"] for org in api.get("/api/onboarding/suggestions/").json()["orgs"]]
    assert "bare" not in onboarding


@pytest.mark.django_db
def test_investor_alerts_announce_organisations_new_in_discover():
    investor = unlock(make_user("inv"))
    week_ago = timezone.now() - timedelta(days=7)
    old = unlock_org(make_org(make_user("ana"), slug="old", status=Organization.Status.LIVE))
    Organization.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=60))
    Organization.objects.filter(pk=old.pk).update(discoverable_since=timezone.now() - timedelta(days=1))
    bare = make_org(make_user("bob"), slug="bare", status=Organization.Status.LIVE)
    assert [org.slug for org in matching_orgs_for(investor, week_ago)] == ["old"]
    assert bare.slug not in [org.slug for org in matching_orgs_for(investor, week_ago)]


# ----------------------------------------------------------- rungs 5–8


@pytest.mark.django_db
def test_a_confirmed_role_is_team_confirmed_and_a_pending_one_is_not():
    org = unlock_org(make_org(make_user("ana"), status=Organization.Status.LIVE))
    person = make_user("bob")
    claim = Affiliation.objects.create(
        user=person, org=org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1), created_by=person
    )
    assert rung(org_verification_ladder(org), "team_confirmed")["done"] is False

    claim.status = Affiliation.Status.VERIFIED
    claim.verified_via = Affiliation.VerifiedVia.ORG
    claim.verified_at = timezone.now()
    claim.save()
    team = rung(org_verification_ladder(org), "team_confirmed")
    assert team["done"] is True
    assert team["detail"] == "1 person confirmed"


@pytest.mark.django_db
def test_registry_states():
    org = make_org(make_user("ana"))

    pending = registry(org, status=Verification.Status.PENDING)
    step = rung(org_verification_ladder(org), "registry_confirmed")
    assert step["done"] is False and step["pending"] is True

    pending.status = Verification.Status.REJECTED
    pending.rejection_reason = "The code has expired."
    pending.save()
    step = rung(org_verification_ladder(org), "registry_confirmed")
    assert step["done"] is False and step["pending"] is False
    assert step["warning"] == "Not confirmed: The code has expired."

    registry(org, valid_until=timezone.now() + timedelta(days=200))
    step = rung(org_verification_ladder(org), "registry_confirmed")
    assert step["done"] is True
    assert step["attested_by"] == "Company registry"
    assert step["detail"].startswith("Certidão permanente checked · valid until")
    assert step["warning"] == ""


@pytest.mark.django_db
def test_registry_warns_before_it_runs_out_and_drops_after():
    org = make_org(make_user("ana"))
    check = registry(org, valid_until=timezone.now() + timedelta(days=20))
    step = rung(org_verification_ladder(org), "registry_confirmed")
    assert step["done"] is True
    assert "Expires in 20 days" in step["warning"]

    check.valid_until = timezone.now() - timedelta(days=1)
    check.save()
    step = rung(org_verification_ladder(org), "registry_confirmed")
    assert step["done"] is False
    assert "expired" in step["warning"]


@pytest.mark.django_db
def test_submitting_the_access_code_puts_the_rung_in_review(api):
    owner = make_user("ana")
    org = make_org(owner)
    api.force_authenticate(owner)
    res = api.post(
        f"/api/orgs/{org.slug}/verifications/",
        {"type": "company_registry", "nif": "503504564", "access_code": "1234-5678-9012"},
    )
    assert res.status_code == 201
    assert rung(org_verification_ladder(org), "registry_confirmed")["pending"] is True


@pytest.mark.django_db
def test_verified_by_beedero_reads_the_flag():
    org = make_org(make_user("ana"), is_verified=True)
    assert rung(org_verification_ladder(org), "beedero_verified")["done"] is True


@pytest.mark.django_db
def test_seven_days_of_updates_climb_the_last_rung():
    org = make_org(make_user("ana"))
    start = datetime(2026, 9, 1, 10, 0, tzinfo=LISBON)
    for day in range(6):
        post_on(org, start + timedelta(days=day))
    last = rung(org_verification_ladder(org), "daily_week")
    assert last["done"] is False and last["progress"] == 6

    post_on(org, start + timedelta(days=6))
    last = rung(org_verification_ladder(org), "daily_week")
    assert last["done"] is True and last["progress"] == 7


@pytest.mark.django_db
def test_personal_posts_by_the_team_do_not_count_for_the_organisation():
    owner = make_user("ana")
    org = make_org(owner)
    start = datetime(2026, 9, 1, 10, 0, tzinfo=LISBON)
    for day in range(7):
        activity = Activity.objects.create(
            author=owner, kind=Activity.Kind.UPDATE, title="Me", occurred_at=start
        )
        Activity.objects.filter(pk=activity.pk).update(created_at=start + timedelta(days=day))
    assert longest_daily_run(org) == 0


@pytest.mark.django_db
def test_every_rung_done_is_a_hundred_percent():
    owner = make_user("ana")
    org = unlock_org(make_org(owner, is_verified=True, status=Organization.Status.LIVE), person=owner)
    person = make_user("bob")
    Affiliation.objects.create(
        user=person,
        org=org,
        role=RoleType.EMPLOYEE,
        started_on=date(2024, 1, 1),
        status=Affiliation.Status.VERIFIED,
        verified_via=Affiliation.VerifiedVia.ORG,
        verified_at=timezone.now(),
        created_by=person,
    )
    registry(org, valid_until=timezone.now() + timedelta(days=300))
    start = datetime(2026, 9, 1, 10, 0, tzinfo=LISBON)
    for day in range(7):
        post_on(org, start + timedelta(days=day))
    ladder = org_verification_ladder(org)
    assert ladder["percent"] == 100
    assert ladder["next"] is None
    assert ladder["listed"] is True
