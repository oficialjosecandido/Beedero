import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import OrgField, Organization, OrgMembership


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner_unverified(db):
    return User.objects.create_user(username="owner@google.com", email="owner@google.com", password="x")


def _make_publish_ready(org):
    org.logo = "org_logos/acme.png"
    org.stage = "seed"
    org.sector = "fintech"
    org.geo = "PT"
    org.save(update_fields=["logo", "stage", "sector", "geo"])
    about = org.sections.get(kind=SectionKind.ABOUT)
    for key in ("summary", "mission", "vision", "values"):
        OrgField.objects.create(section=about, key=key, value=key)
    products = org.sections.get(kind=SectionKind.PRODUCTS)
    OrgField.objects.create(section=products, key="overview", value="Product")


@pytest.mark.django_db
def test_domain_match_does_not_verify_before_email_confirmed(api, owner_unverified):
    api.force_authenticate(owner_unverified)
    res = api.post("/api/orgs/", {"name": "Google", "one_liner": "We search things"}, format="json")
    assert res.status_code == 201
    org = Organization.objects.get(slug=res.data["slug"])
    assert org.is_verified is False

    # Publishing is blocked until the owner's email is confirmed — the
    # domain-match verification must not have been granted at creation.
    res = api.post(f"/api/orgs/{org.slug}/activate/")
    assert res.status_code == 403
    org.refresh_from_db()
    assert org.is_verified is False


@pytest.mark.django_db
def test_domain_match_verifies_only_after_email_confirmed_and_published(api, owner_unverified):
    api.force_authenticate(owner_unverified)
    res = api.post("/api/orgs/", {"name": "Google", "one_liner": "We search things"}, format="json")
    org = Organization.objects.get(slug=res.data["slug"])

    owner_unverified.email_verified_at = timezone.now()
    owner_unverified.save(update_fields=["email_verified_at"])
    _make_publish_ready(org)

    res = api.post(f"/api/orgs/{org.slug}/activate/")
    assert res.status_code == 200
    org.refresh_from_db()
    assert org.is_verified is True
    assert org.status == Organization.Status.LIVE


@pytest.mark.django_db
def test_non_matching_domain_never_verifies(api, db):
    owner = User.objects.create_user(username="owner@yahoo.com", email="owner@yahoo.com", password="x")
    owner.email_verified_at = timezone.now()
    owner.save(update_fields=["email_verified_at"])
    api.force_authenticate(owner)

    res = api.post("/api/orgs/", {"name": "Google", "one_liner": "Not actually Google"}, format="json")
    org = Organization.objects.get(slug=res.data["slug"])
    _make_publish_ready(org)

    res = api.post(f"/api/orgs/{org.slug}/activate/")
    assert res.status_code == 200
    org.refresh_from_db()
    assert org.is_verified is False


@pytest.mark.django_db
def test_activate_requires_complete_profile(api, owner_unverified):
    api.force_authenticate(owner_unverified)
    res = api.post("/api/orgs/", {"name": "Acme", "one_liner": "We build things"}, format="json")
    org = Organization.objects.get(slug=res.data["slug"])

    owner_unverified.email_verified_at = timezone.now()
    owner_unverified.save(update_fields=["email_verified_at"])

    res = api.post(f"/api/orgs/{org.slug}/activate/")
    assert res.status_code == 400
    assert "required profile fields" in res.data["detail"]


@pytest.mark.django_db
def test_org_member_can_read_onboarding(api, owner_unverified):
    api.force_authenticate(owner_unverified)
    res = api.post("/api/orgs/", {"name": "Acme", "one_liner": "We build things"}, format="json")
    org = Organization.objects.get(slug=res.data["slug"])

    member = User.objects.create_user(username="member@acme.com", email="member@acme.com", password="x")
    OrgMembership.objects.create(org=org, user=member, role=OrgMembership.Role.MEMBER)

    api.force_authenticate(member)
    res = api.get(f"/api/orgs/{org.slug}/onboarding/")
    assert res.status_code == 200
    assert "checklist" in res.data
    assert "completeness" in res.data
