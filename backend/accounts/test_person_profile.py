import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from analytics.models import PersonProfileView
from orgs.models import Activity, Organization, OrgMembership


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
        handle="ada-lovelace",
        is_verified=True,
    )
    return profile


@pytest.mark.django_db
def test_public_person_profile_is_public(api, person):
    res = api.get("/api/public/people/ada-lovelace/")
    assert res.status_code == 200
    body = res.json()
    assert body["person"]["full_name"] == "Ada Lovelace"
    assert body["person"]["is_verified"] is True
    assert "completeness" not in body


@pytest.mark.django_db
def test_public_person_profile_hides_private_bio(api, person):
    person.visibility = {"bio": "private"}
    person.bio = "Secret bio"
    person.save(update_fields=["visibility", "bio"])
    res = api.get("/api/public/people/ada-lovelace/")
    assert res.status_code == 200
    assert "bio" not in res.json()["person"]


@pytest.mark.django_db
def test_public_person_profile_incomplete_returns_404(api, person):
    person.full_name = ""
    person.save(update_fields=["full_name"])
    res = api.get("/api/public/people/ada-lovelace/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_person_badge_svg_is_public(api, person):
    res = api.get("/api/public/pbadge/ada-lovelace/svg/")
    assert res.status_code == 200
    assert res["Content-Type"] == "image/svg+xml"
    assert b"Ada Lovelace" in res.content


@pytest.mark.django_db
def test_person_badge_json_is_public(api, person):
    res = api.get("/api/public/pbadge/ada-lovelace/json/")
    assert res.status_code == 200
    data = res.json()
    assert data["handle"] == "ada-lovelace"
    assert data["verified"] is True


@pytest.mark.django_db
def test_attestations_respect_opt_in(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.OWNER)
    person.attestation_prefs = {"show_memberships": False}
    person.save(update_fields=["attestation_prefs"])
    res = api.get("/api/public/people/ada-lovelace/")
    kinds = [a["kind"] for a in res.json()["attestations"]]
    assert "org_membership" not in kinds


@pytest.mark.django_db
def test_attestations_show_membership_when_opted_in(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.OWNER)
    res = api.get("/api/public/people/ada-lovelace/")
    kinds = [a["kind"] for a in res.json()["attestations"]]
    assert "org_membership" in kinds


@pytest.mark.django_db
def test_vitality_is_private_to_owner(api, person):
    api.force_authenticate(person.user)
    res = api.get("/api/investors/me/vitality/")
    assert res.status_code == 200
    assert "completeness" in res.json()


@pytest.mark.django_db
def test_badge_embed_requires_handle(api, person):
    api.force_authenticate(person.user)
    res = api.get("/api/investors/me/badge-embed/")
    assert res.status_code == 200
    assert "/p/ada-lovelace" in res.json()["profile_url"]


@pytest.mark.django_db
def test_profile_view_recorded(api, person):
    viewer = User.objects.create_user(username="v", email="v@example.com", password="x")
    api.force_authenticate(viewer)
    api.get("/api/public/people/ada-lovelace/")
    assert PersonProfileView.objects.filter(subject=person.user, viewer=viewer).count() == 1


@pytest.mark.django_db
def test_handle_validation(api, person):
    api.force_authenticate(person.user)
    res = api.put("/api/investors/me/", {"handle": "ab"}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_discovery_ranks_complete_verified_first(api):
    viewer = User.objects.create_user(username="viewer", email="viewer@example.com", password="x")
    weak = User.objects.create_user(username="weak", email="weak@example.com", password="x")
    InvestorProfile.objects.create(user=weak, full_name="Zara Weak", headline="Operator", country="PT")
    strong = User.objects.create_user(username="strong", email="strong@example.com", password="x")
    InvestorProfile.objects.create(
        user=strong,
        full_name="Anna Strong",
        headline="Investor",
        country="GB",
        handle="anna-strong",
        is_verified=True,
    )
    Activity.objects.create(
        author=strong,
        org=None,
        kind="update",
        title="Hello",
        body="",
        occurred_at=timezone.now(),
    )
    org = Organization.objects.create(slug="testco", name="TestCo", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=strong, role=OrgMembership.Role.OWNER)

    api.force_authenticate(viewer)
    res = api.get("/api/discovery/people/")
    names = [item["name"] for item in res.json()["items"]]
    assert names.index("Anna Strong") < names.index("Zara Weak")
