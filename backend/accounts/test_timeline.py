from datetime import date

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, SelfDeclaredExperience, User
from accounts.skills import normalize_skills
from accounts.timeline import person_timeline
from orgs.models import Activity, MembershipSkill, Organization, OrgMembership


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def person(db):
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    profile = InvestorProfile.objects.create(
        user=user,
        full_name="Ada Lovelace",
        headline="Angel investor",
        country="GB",
        handle="adalovelace",
        is_verified=True,
    )
    return profile


@pytest.mark.django_db
def test_person_timeline_includes_verified_membership_band(person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(
        org=org,
        user=person.user,
        role=OrgMembership.Role.ADVISOR,
        started_on=date(2020, 1, 1),
        ended_on=date(2022, 1, 1),
    )
    bands = person_timeline(person, person.user)
    assert len(bands) == 1
    band = bands[0]
    assert band["org_name"] == "Acme"
    assert band["verified"] is True
    assert band["verified_via"] == "org_membership"
    assert band["started_on"] == "2020-01-01"
    assert band["ended_on"] == "2022-01-01"


@pytest.mark.django_db
def test_person_timeline_includes_self_declared_band(person):
    SelfDeclaredExperience.objects.create(
        user=person.user,
        org_name="Old Startup Inc",
        role="Founder",
        started_on=date(2015, 1, 1),
        ended_on=date(2018, 1, 1),
    )
    bands = person_timeline(person, person.user)
    assert len(bands) == 1
    band = bands[0]
    assert band["org_name"] == "Old Startup Inc"
    assert band["verified"] is False
    assert band["verified_via"] is None
    assert band["org_slug"] is None


@pytest.mark.django_db
def test_person_timeline_sorted_most_recent_first(person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(
        org=org, user=person.user, role=OrgMembership.Role.MEMBER, started_on=date(2018, 1, 1)
    )
    SelfDeclaredExperience.objects.create(
        user=person.user, org_name="Newer Co", started_on=date(2023, 1, 1)
    )
    bands = person_timeline(person, person.user)
    assert [b["org_name"] for b in bands] == ["Newer Co", "Acme"]


@pytest.mark.django_db
def test_person_timeline_anchors_milestones_by_date_range(person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(
        org=org,
        user=person.user,
        role=OrgMembership.Role.MEMBER,
        started_on=date(2020, 1, 1),
        ended_on=date(2021, 1, 1),
    )
    Activity.objects.create(
        author=person.user,
        org=None,
        kind=Activity.Kind.MILESTONES,
        title="Inside the window",
        occurred_at=timezone.make_aware(timezone.datetime(2020, 6, 1)),
    )
    Activity.objects.create(
        author=person.user,
        org=None,
        kind=Activity.Kind.MILESTONES,
        title="Outside the window",
        occurred_at=timezone.make_aware(timezone.datetime(2022, 1, 1)),
    )
    bands = person_timeline(person, person.user)
    titles = [m["title"] for m in bands[0]["milestones"]]
    assert titles == ["Inside the window"]


@pytest.mark.django_db
def test_person_timeline_carries_membership_skills(person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    membership = OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.MEMBER)
    MembershipSkill.objects.create(membership=membership, skill="React")
    bands = person_timeline(person, person.user)
    assert bands[0]["skills"] == [{"skill": "React", "status": "declared"}]


@pytest.mark.django_db
def test_person_timeline_hidden_when_memberships_private(person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.MEMBER)
    person.visibility = {"memberships": "private"}
    person.save(update_fields=["visibility"])

    other = User.objects.create_user(username="v", email="v@example.com", password="x")
    assert person_timeline(person, other) == []
    assert person_timeline(person, person.user) != []


@pytest.mark.django_db
def test_public_person_profile_exposes_timeline_and_skills(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    membership = OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.MEMBER)
    MembershipSkill.objects.create(membership=membership, skill="React")
    person.skills = ["Fundraising"]
    person.save(update_fields=["skills"])

    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    body = res.json()
    assert len(body["timeline"]) == 1
    assert body["skills"]["free"] == ["Fundraising"]
    assert body["skills"]["aggregated"][0]["skill"] == "React"
    assert body["skills"]["aggregated"][0]["org_count"] == 1


@pytest.mark.django_db
def test_public_person_profile_hides_skills_when_private(api, person):
    person.visibility = {"skills": "private"}
    person.skills = ["Fundraising"]
    person.save(update_fields=["visibility", "skills"])
    res = api.get("/api/public/people/adalovelace/")
    assert "skills" not in res.json()


def test_normalize_skills_dedupes_case_insensitively():
    assert normalize_skills(["React", "react", " React "]) == ["React"]


def test_normalize_skills_caps_length_and_count():
    long_skill = "x" * 100
    assert len(normalize_skills([long_skill])[0]) == 40
    many = [f"skill{i}" for i in range(50)]
    assert len(normalize_skills(many)) == 30


@pytest.mark.django_db
def test_investor_post_rejects_event_kind(api, person):
    api.force_authenticate(person.user)
    res = api.post(
        "/api/investors/me/posts/",
        {"kind": "event", "title": "A launch party", "occurred_at": timezone.now().isoformat()},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_public_person_profile_never_leaks_engagement_counts(api, person):
    Activity.objects.create(
        author=person.user,
        org=None,
        kind="update",
        title="Hello",
        occurred_at=timezone.now(),
        reaction_count=5,
        comment_count=3,
    )
    res = api.get("/api/public/people/adalovelace/")
    body = res.json()
    assert body["posts"], "expected at least one post in the response"
    for post in body["posts"]:
        assert "reaction_count" not in post
        assert "comment_count" not in post
        assert "like_count" not in post
