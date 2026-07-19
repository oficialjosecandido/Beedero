import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import Activity, OrgField, OrgMembership, Organization


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


def _seed_profile_fields(org):
    about = org.sections.get(kind=SectionKind.ABOUT)
    team = org.sections.get(kind=SectionKind.TEAM)
    for key in ("summary", "mission", "vision", "values"):
        OrgField.objects.create(section=about, key=key, value=key)
    OrgField.objects.create(section=team, key="founder", value={"name": "Ada"})


@pytest.mark.django_db
def test_org_feed_allows_event_without_profile_field_gate(api, org, founder):
    api.force_authenticate(founder)
    res = api.post(
        f"/api/orgs/{org.slug}/feed/",
        {
            "kind": SectionKind.EVENTS,
            "title": "Demo day",
            "body": "Join us",
            "occurred_at": "2026-07-18T10:00:00Z",
            "ends_at": "2026-07-18T12:00:00Z",
        },
        format="json",
    )
    assert res.status_code == 201
    assert Activity.objects.filter(org=org, kind=SectionKind.EVENTS).count() == 1


@pytest.mark.django_db
def test_org_feed_rejects_milestone_photo(api, org, founder):
    _seed_profile_fields(org)
    image = SimpleUploadedFile("shot.png", b"fake", content_type="image/png")

    api.force_authenticate(founder)
    res = api.post(
        f"/api/orgs/{org.slug}/feed/",
        {
            "kind": SectionKind.MILESTONES,
            "title": "Shipped",
            "body": "v1",
            "occurred_at": "2026-07-13T12:00:00Z",
            "image": image,
        },
        format="multipart",
    )

    assert res.status_code == 400
    assert "image" in res.data
