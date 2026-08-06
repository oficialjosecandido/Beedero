from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs import discovery
from orgs.constants import SectionKind
from orgs.models import Organization, OrgField, OrgSection, VisibilityGrant


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def viewer(db):
    return User.objects.create_user(username="viewer", email="viewer@example.com", password="x")


def _make_orgs(n, prefix="org"):
    return [
        Organization.objects.create(slug=f"{prefix}{i}", name=f"{prefix}{i}", status=Organization.Status.LIVE)
        for i in range(n)
    ]


@pytest.mark.django_db
def test_discovery_default_page_size_and_next_offset(api, viewer):
    _make_orgs(25)
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/")
    assert res.status_code == 200
    assert len(res.data["items"]) == 20
    assert res.data["next_offset"] == 20


@pytest.mark.django_db
def test_discovery_second_page_via_offset(api, viewer):
    _make_orgs(25)
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/?offset=20")
    assert res.status_code == 200
    assert len(res.data["items"]) == 5
    assert res.data["next_offset"] is None


@pytest.mark.django_db
def test_discovery_limit_is_capped(api, viewer):
    _make_orgs(60)
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/?limit=1000")
    assert res.status_code == 200
    assert len(res.data["items"]) == 50


@pytest.mark.django_db
def test_discovery_no_more_pages_when_exact_fit(api, viewer):
    _make_orgs(20)
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/")
    assert len(res.data["items"]) == 20
    assert res.data["next_offset"] is None


@pytest.mark.django_db
def test_discover_people_search_by_name(api, viewer):
    target = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(user=target, full_name="Ada Lovelace", headline="Angel investor")
    api.force_authenticate(viewer)
    res = api.get("/api/discovery/people/?q=ada")
    assert res.status_code == 200
    assert len(res.data["items"]) == 1
    assert res.data["items"][0]["name"] == "Ada Lovelace"
    assert res.data["items"][0]["is_following"] is False


@pytest.mark.django_db
def test_follow_user_and_discover_people_reflects_following(api, viewer):
    from orgs.models import UserFollow

    target = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(user=target, full_name="Ada Lovelace", headline="Angel investor")
    api.force_authenticate(viewer)

    follow_res = api.post(f"/api/users/{target.id}/follow/")
    assert follow_res.status_code == 204
    assert UserFollow.objects.filter(follower=viewer, followed=target).exists()

    from notifications.models import Notification

    notification = Notification.objects.get(user=target, kind=Notification.Kind.FOLLOWER)
    assert notification.title == "New follower"
    assert notification.link == "/dashboard"

    res = api.get("/api/discovery/people/?q=ada")
    assert res.status_code == 200
    assert res.data["items"][0]["is_following"] is True


@pytest.mark.django_db
def test_metric_filter_only_resolves_up_to_candidate_cap(db, viewer):
    orgs = _make_orgs(10, prefix="metric")
    for org in orgs:
        section = OrgSection.objects.create(org=org, kind=SectionKind.FINANCIALS)
        field = OrgField.objects.create(section=section, key="mrr", value="1000")
        VisibilityGrant.objects.create(
            org=org, field=field, principal_type=VisibilityGrant.Principal.ROLE, principal_id="verified_investor"
        )

    InvestorProfile.objects.create(user=viewer, is_verified=True)

    with patch.object(discovery, "MAX_METRIC_CANDIDATES", 3):
        qs = discovery.discover(viewer, {"metric": "mrr", "metric_min": "500"})
        assert qs.count() == 3
