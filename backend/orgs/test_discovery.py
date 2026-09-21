from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs import discovery, views
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
    assert res.data["items"][0]["connection_status"] == "none"


@pytest.mark.django_db
def test_connect_with_user_and_discover_people_reflects_connection(api, viewer):
    from connections.models import Connection

    target = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(user=target, full_name="Ada Lovelace", headline="Angel investor")
    api.force_authenticate(viewer)

    first, second = sorted([viewer, target], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)

    res = api.get("/api/discovery/people/?q=ada")
    assert res.status_code == 200
    assert res.data["items"][0]["connection_status"] == "connected"


def _person(username, name, city="", visibility=None):
    user = User.objects.create_user(username=username, email=f"{username}@example.com", password="x")
    return InvestorProfile.objects.create(
        user=user,
        full_name=name,
        headline="Builder",
        city=city,
        visibility=visibility or {},
    )


@pytest.mark.django_db
def test_city_filter_matches_however_the_city_was_typed(api, viewer):
    _person("ada", "Ada Lovelace", city="Lisboa")
    _person("grace", "Grace Hopper", city="Porto")
    api.force_authenticate(viewer)

    res = api.get("/api/discovery/people/?city=lisbon")
    assert res.status_code == 200
    assert [item["name"] for item in res.data["items"]] == ["Ada Lovelace"]
    assert res.data["items"][0]["city"] == "Lisboa"

    # And the other way round: typed "Lisboa", searched "Lisboa, Portugal".
    assert len(api.get("/api/discovery/people/?city=Lisboa, Portugal").data["items"]) == 1


@pytest.mark.django_db
def test_city_filter_skips_people_who_made_their_location_private(api, viewer):
    """Otherwise the filter is a way to guess a private city one query at a
    time — ask for each city and see who appears."""
    _person("ada", "Ada Lovelace", city="Lisboa", visibility={"country": "private"})
    api.force_authenticate(viewer)

    res = api.get("/api/discovery/people/?city=lisbon")
    assert res.data["items"] == []

    # Still findable by name — only the location is gated, and it doesn't
    # ride along in the listing either.
    found = api.get("/api/discovery/people/?q=ada").data["items"]
    assert len(found) == 1
    assert found[0]["city"] == ""


@pytest.mark.django_db
def test_listings_show_the_city_when_the_location_is_public(api, viewer):
    _person("ada", "Ada Lovelace", city="Lisboa")
    api.force_authenticate(viewer)
    assert api.get("/api/discovery/people/?q=ada").data["items"][0]["city"] == "Lisboa"


@pytest.mark.django_db
def test_city_filter_honours_verified_investors_only_location(api, viewer):
    _person("ada", "Ada Lovelace", city="Lisboa", visibility={"country": "verified_investors"})
    viewer_profile = InvestorProfile.objects.create(user=viewer, full_name="Viewer")
    api.force_authenticate(viewer)

    assert api.get("/api/discovery/people/?city=lisbon").data["items"] == []

    viewer_profile.is_verified = True
    viewer_profile.save(update_fields=["is_verified"])
    assert len(api.get("/api/discovery/people/?city=lisbon").data["items"]) == 1


@pytest.mark.django_db
def test_city_summary_counts_the_viewers_own_city(api, viewer):
    InvestorProfile.objects.create(user=viewer, full_name="Viewer", city="lisbon")
    _person("ada", "Ada Lovelace", city="Lisboa")
    _person("alan", "Alan Turing", city="LISBOA, Portugal")
    _person("grace", "Grace Hopper", city="Porto")
    api.force_authenticate(viewer)

    summary = api.get("/api/discovery/people/").data["city_summary"]
    assert summary["city_key"] == "lisbon"
    assert summary["count"] == 2  # the viewer isn't counted as company


@pytest.mark.django_db
def test_city_summary_is_absent_until_the_viewer_declares_a_city(api, viewer):
    InvestorProfile.objects.create(user=viewer, full_name="Viewer")
    _person("ada", "Ada Lovelace", city="Lisboa")
    api.force_authenticate(viewer)

    assert api.get("/api/discovery/people/").data["city_summary"] is None


@pytest.mark.django_db
def test_people_search_is_rate_limited(api, viewer):
    api.force_authenticate(viewer)
    with patch.object(views.DiscoverPeopleView, "SEARCHES_PER_HOUR", 2):
        assert api.get("/api/discovery/people/").status_code == 200
        assert api.get("/api/discovery/people/").status_code == 200
        assert api.get("/api/discovery/people/").status_code == 429


@pytest.mark.django_db
def test_people_search_only_walks_up_to_the_candidate_cap(api, viewer):
    for i in range(6):
        _person(f"p{i}", f"Person {i}")
    api.force_authenticate(viewer)

    with patch.object(discovery, "MAX_PEOPLE_CANDIDATES", 3):
        res = api.get("/api/discovery/people/")
        assert len(res.data["items"]) == 3


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
