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
        handle="adalovelace",
        is_verified=True,
    )
    return profile


@pytest.mark.django_db
def test_public_person_profile_is_public(api, person):
    res = api.get("/api/public/people/adalovelace/")
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
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    assert "bio" not in res.json()["person"]


@pytest.mark.django_db
def test_public_person_profile_incomplete_returns_404(api, person):
    person.full_name = ""
    person.save(update_fields=["full_name"])
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_person_badge_svg_is_public(api, person):
    res = api.get("/api/public/pbadge/adalovelace/svg/")
    assert res.status_code == 200
    assert res["Content-Type"] == "image/svg+xml"
    assert b"Ada Lovelace" in res.content


@pytest.mark.django_db
def test_person_badge_json_is_public(api, person):
    res = api.get("/api/public/pbadge/adalovelace/json/")
    assert res.status_code == 200
    data = res.json()
    assert data["handle"] == "adalovelace"
    assert data["verified"] is True


@pytest.mark.django_db
def test_attestations_respect_opt_in(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.OWNER)
    person.attestation_prefs = {"show_memberships": False}
    person.save(update_fields=["attestation_prefs"])
    res = api.get("/api/public/people/adalovelace/")
    kinds = [a["kind"] for a in res.json()["attestations"]]
    assert "org_membership" not in kinds


@pytest.mark.django_db
def test_attestations_show_membership_when_opted_in(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.OWNER)
    res = api.get("/api/public/people/adalovelace/")
    kinds = [a["kind"] for a in res.json()["attestations"]]
    assert "org_membership" in kinds


@pytest.mark.django_db
def test_attestations_include_org_logo(api, person):
    from django.core.files.uploadedfile import SimpleUploadedFile

    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    org.logo = SimpleUploadedFile("logo.png", b"fake", content_type="image/png")
    org.save(update_fields=["logo"])
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.OWNER)
    res = api.get("/api/public/people/adalovelace/")
    membership = next(a for a in res.json()["attestations"] if a["kind"] == "org_membership")
    assert membership["org_name"] == "Acme"
    assert membership["org_logo"] is not None


@pytest.mark.django_db
def test_attestations_show_advisor_role_label(api, person):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=person.user, role=OrgMembership.Role.ADVISOR)
    res = api.get("/api/public/people/adalovelace/")
    membership = next(a for a in res.json()["attestations"] if a["kind"] == "org_membership")
    assert membership["label"] == "Advisor at Acme"


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
    assert "/p/adalovelace" in res.json()["profile_url"]


@pytest.mark.django_db
def test_profile_view_recorded(api, person):
    viewer = User.objects.create_user(username="v", email="v@example.com", password="x")
    api.force_authenticate(viewer)
    api.get("/api/public/people/adalovelace/")
    assert PersonProfileView.objects.filter(subject=person.user, viewer=viewer).count() == 1


@pytest.mark.django_db
def test_public_profile_viewer_actions_for_unconnected_viewer(api, person):
    viewer = User.objects.create_user(username="v", email="v@example.com", password="x")
    api.force_authenticate(viewer)
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    actions = res.json()["viewer_actions"]
    assert actions["can_message"] is False
    assert actions["connection_status"] == "none"
    assert actions["user_id"] == person.user_id


@pytest.mark.django_db
def test_public_profile_viewer_actions_for_connected_viewer(api, person):
    from connections.models import Connection

    viewer = User.objects.create_user(username="v", email="v@example.com", password="x")
    first, second = sorted([viewer, person.user], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)

    api.force_authenticate(viewer)
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    actions = res.json()["viewer_actions"]
    assert actions["can_message"] is True
    assert actions["connection_status"] == "connected"


@pytest.mark.django_db
def test_public_profile_hides_viewer_actions_for_owner(api, person):
    api.force_authenticate(person.user)
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    assert "viewer_actions" not in res.json()


@pytest.mark.django_db
def test_public_profile_hides_viewer_actions_for_anonymous(api, person):
    res = api.get("/api/public/people/adalovelace/")
    assert res.status_code == 200
    assert "viewer_actions" not in res.json()


@pytest.mark.django_db
def test_handle_is_assigned_from_full_name(api, db):
    user = User.objects.create_user(username="julio", email="julio@example.com", password="x")
    api.force_authenticate(user)
    res = api.put(
        "/api/investors/me/",
        {"full_name": "Júlio Pomar", "headline": "Investor", "country": "PT"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["handle"] == "juliopomar"


@pytest.mark.django_db
def test_investor_profile_auto_handle_after_name_saved(api, db):
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    api.force_authenticate(user)
    res = api.put(
        "/api/investors/me/",
        {"full_name": "Ada Lovelace", "headline": "Angel investor", "country": "GB"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["handle"] == "adalovelace"
    assert res.data["has_public_handle"] is True


@pytest.mark.django_db
def test_full_name_cannot_be_changed_after_set(api, person):
    api.force_authenticate(person.user)
    res = api.put("/api/investors/me/", {"full_name": "Someone Else"}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_handle_cannot_be_changed_manually(api, person):
    api.force_authenticate(person.user)
    res = api.put("/api/investors/me/", {"handle": "custom-handle"}, format="json")
    assert res.status_code == 200
    assert res.data["handle"] == "adalovelace"


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
        handle="annastrong",
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
