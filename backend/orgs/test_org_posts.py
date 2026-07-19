import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from credibility.models import Verification, VerificationType
from orgs.constants import SectionKind
from orgs.models import Activity, OrgMembership, Organization
from orgs.posting.freshness import discovery_score, recency_factor


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


def _verify(org, type_):
    Verification.objects.create(
        org=org,
        type=type_,
        status=Verification.Status.VERIFIED,
        valid_until=None,
        payload={},
    )


@pytest.mark.django_db
def test_invalid_event_payload_rejected(api, org, founder):
    _verify(org, VerificationType.COMPANY_REGISTRY)
    _verify(org, VerificationType.FOUNDER_ROLE)
    _verify(org, VerificationType.TAX_CLEARANCE)
    _verify(org, VerificationType.SS_CLEARANCE)
    api.force_authenticate(founder)

    res = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {
            "kind": "event",
            "title": "Demo",
            "starts_at": "2026-07-20T10:00:00Z",
            "ends_at": "2026-07-20T09:00:00Z",
            "format": "online",
        },
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_second_post_same_lisbon_day_returns_429(api, org, founder):
    api.force_authenticate(founder)
    first = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "First update of the day"},
        format="json",
    )
    assert first.status_code == 201

    second = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "Second update"},
        format="json",
    )
    assert second.status_code == 429

    activity_id = first.data["id"]
    api.delete(f"/api/orgs/{org.slug}/posts/{activity_id}/")
    third = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "After delete"},
        format="json",
    )
    assert third.status_code == 201


@pytest.mark.django_db
def test_level_zero_can_update_not_event(api, org, founder):
    api.force_authenticate(founder)
    ok = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "Hello world"},
        format="json",
    )
    assert ok.status_code == 201

    blocked = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {
            "kind": "event",
            "title": "Demo",
            "starts_at": "2026-07-20T10:00:00Z",
            "ends_at": "2026-07-20T12:00:00Z",
            "format": "online",
        },
        format="json",
    )
    assert blocked.status_code == 400
    assert "level 2" in str(blocked.data).lower()


@pytest.mark.django_db
def test_feed_orders_by_created_at_not_milestone_display_date(api, org, founder):
    Activity.objects.create(
        org=org,
        kind=SectionKind.MILESTONES,
        title="Old milestone",
        body="",
        occurred_at=timezone.now(),
        created_at=timezone.now(),
        payload={"category": "traction", "occurred_at": "2020-01-01"},
    )
    newer = Activity.objects.create(
        org=org,
        kind=SectionKind.NEWS,
        title="Recent update",
        body="news",
        occurred_at=timezone.now() - timezone.timedelta(days=30),
        created_at=timezone.now(),
    )

    api.force_authenticate(founder)
    res = api.get("/api/feed/")
    titles = [item["value"]["title"] for item in res.data["items"]]
    assert titles.index("Recent update") < titles.index("Old milestone")


@pytest.mark.django_db
def test_inactive_high_cred_org_stays_above_active_low_cred(org, db):
    high = Organization.objects.create(slug="high", name="High", status=Organization.Status.LIVE)
    low = Organization.objects.create(slug="low", name="Low", status=Organization.Status.LIVE)

    for type_ in (
        VerificationType.COMPANY_REGISTRY,
        VerificationType.FOUNDER_ROLE,
        VerificationType.TAX_CLEARANCE,
        VerificationType.SS_CLEARANCE,
        VerificationType.ANNUAL_ACCOUNTS,
    ):
        _verify(high, type_)
    _verify(low, VerificationType.COMPANY_REGISTRY)
    _verify(low, VerificationType.FOUNDER_ROLE)

    Activity.objects.create(
        org=low,
        kind=SectionKind.NEWS,
        title="Active",
        body="",
        occurred_at=timezone.now(),
    )
    stale = Activity.objects.create(
        org=high,
        kind=SectionKind.NEWS,
        title="Stale",
        body="",
        occurred_at=timezone.now(),
    )
    Activity.objects.filter(pk=stale.pk).update(created_at=timezone.now() - timezone.timedelta(days=90))

    assert discovery_score(high) > discovery_score(low)
    assert recency_factor(high) == 0.85
    assert recency_factor(low) == 1.0


@pytest.mark.django_db
def test_posting_status_lists_locked_kinds(api, org, founder):
    api.force_authenticate(founder)
    res = api.get(f"/api/orgs/{org.slug}/posting-status/")
    assert res.status_code == 200
    assert "update" in res.data["allowed_kinds"]
    locked = {item["kind"] for item in res.data["locked_kinds"]}
    assert "event" in locked
