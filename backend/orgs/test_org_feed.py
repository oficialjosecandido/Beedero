import pytest
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import Activity, OrgMembership, Organization


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
def test_org_feed_lists_member_activities(api, org, founder):
    Activity.objects.create(
        org=org,
        kind=SectionKind.MILESTONES,
        title="Shipped v1",
        occurred_at=parse_datetime("2026-07-13T12:00:00Z"),
    )

    api.force_authenticate(founder)
    res = api.get(f"/api/orgs/{org.slug}/feed/")

    assert res.status_code == 200
    assert len(res.data["items"]) == 1
    assert res.data["items"][0]["value"]["title"] == "Shipped v1"


@pytest.mark.django_db
def test_org_feed_delete_removes_activity(api, org, founder):
    activity = Activity.objects.create(
        org=org,
        kind=SectionKind.NEWS,
        title="Update",
        occurred_at=parse_datetime("2026-07-13T12:00:00Z"),
    )

    api.force_authenticate(founder)
    res = api.delete(f"/api/orgs/{org.slug}/feed/{activity.id}/")

    assert res.status_code == 204
    assert not Activity.objects.filter(id=activity.id).exists()
