import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import OrgMembership, Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.mark.django_db
def test_section_field_rejects_bogus_visibility(api, org, founder):
    api.force_authenticate(founder)
    res = api.put(
        f"/api/orgs/{org.slug}/sections/{SectionKind.ABOUT}/fields/tagline/",
        {"value": "hi", "visibility": "bananas"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_section_field_rejects_null_value(api, org, founder):
    api.force_authenticate(founder)
    res = api.put(
        f"/api/orgs/{org.slug}/sections/{SectionKind.ABOUT}/fields/tagline/",
        {"value": None},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_section_field_rejects_invalid_key(api, org, founder):
    api.force_authenticate(founder)
    res = api.put(
        f"/api/orgs/{org.slug}/sections/{SectionKind.ABOUT}/fields/Not-A-Valid-Key!/",
        {"value": "hi"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_section_field_accepts_valid_write(api, org, founder):
    api.force_authenticate(founder)
    res = api.put(
        f"/api/orgs/{org.slug}/sections/{SectionKind.ABOUT}/fields/tagline/",
        {"value": "We build things", "visibility": "public"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["value"] == "We build things"


@pytest.mark.django_db
def test_org_patch_rejects_oversized_name(api, org, founder):
    api.force_authenticate(founder)
    res = api.patch(f"/api/orgs/{org.slug}/", {"name": "x" * 500}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_org_patch_accepts_valid_update(api, org, founder):
    api.force_authenticate(founder)
    res = api.patch(f"/api/orgs/{org.slug}/", {"one_liner": "New pitch"}, format="json")
    assert res.status_code == 200
    org.refresh_from_db()
    assert org.one_liner == "New pitch"
