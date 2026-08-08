import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs.models import Organization, OrgMembership

from .discovery import find_advisors
from .models import AdvisorProfile


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def person(db):
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(
        user=user,
        full_name="Ada Lovelace",
        headline="Angel investor",
        country="GB",
        handle="adalovelace",
        is_verified=True,
    )
    return user


@pytest.mark.django_db
def test_get_creates_profile_on_first_access(api, person):
    api.force_authenticate(person)
    res = api.get("/api/advisory/me/")
    assert res.status_code == 200
    assert res.data["is_available"] is False
    assert AdvisorProfile.objects.filter(user=person).exists()


@pytest.mark.django_db
def test_put_persists_fields(api, person):
    api.force_authenticate(person)
    res = api.put(
        "/api/advisory/me/",
        {
            "is_available": True,
            "expertise": ["fundraising", "gtm_sales"],
            "stages": ["seed"],
            "sectors": ["fintech"],
            "engagement_types": ["advisory", "board"],
        },
        format="json",
    )
    assert res.status_code == 200
    profile = AdvisorProfile.objects.get(user=person)
    assert profile.is_available is True
    assert profile.expertise == ["fundraising", "gtm_sales"]
    assert profile.engagement_types == ["advisory", "board"]


@pytest.mark.django_db
def test_find_advisors_excludes_unavailable(db, person):
    AdvisorProfile.objects.create(user=person, is_available=False)
    profiles, _ = find_advisors(None, {})
    assert profiles == []


@pytest.mark.django_db
def test_find_advisors_excludes_incomplete_profile(db):
    user = User.objects.create_user(username="ghost", email="ghost@example.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="", headline="", country="GB")
    AdvisorProfile.objects.create(user=user, is_available=True)
    profiles, _ = find_advisors(None, {})
    assert profiles == []


@pytest.mark.django_db
def test_find_advisors_ranks_by_verified_gig_count(db):
    weak = User.objects.create_user(username="weak", email="weak@example.com", password="x")
    InvestorProfile.objects.create(user=weak, full_name="Zara Weak", headline="Operator", country="PT")
    AdvisorProfile.objects.create(user=weak, is_available=True)

    strong = User.objects.create_user(username="strong", email="strong@example.com", password="x")
    InvestorProfile.objects.create(user=strong, full_name="Anna Strong", headline="Advisor", country="GB")
    AdvisorProfile.objects.create(user=strong, is_available=True)
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=strong, role=OrgMembership.Role.ADVISOR)

    profiles, gig_counts = find_advisors(None, {})
    names = [p.user.investorprofile.full_name for p in profiles]
    assert names.index("Anna Strong") < names.index("Zara Weak")
    assert gig_counts[strong.id] == 1
    assert gig_counts.get(weak.id, 0) == 0


@pytest.mark.django_db
def test_discover_advisors_endpoint(api, person):
    AdvisorProfile.objects.create(user=person, is_available=True, expertise=["fundraising"])
    viewer = User.objects.create_user(username="viewer", email="viewer@example.com", password="x")
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/advisors/")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Ada Lovelace"
    assert items[0]["verified_gig_count"] == 0


@pytest.mark.django_db
def test_public_person_profile_includes_advisor_block_when_present(api, person):
    AdvisorProfile.objects.create(user=person, is_available=True, expertise=["fundraising"])
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    assert res.json()["advisor"] == {
        "is_available": True,
        "expertise": ["fundraising"],
        "stages": [],
        "sectors": [],
        "engagement_types": [],
    }


@pytest.mark.django_db
def test_public_person_profile_omits_advisor_block_when_absent(api, person):
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    assert "advisor" not in res.json()
