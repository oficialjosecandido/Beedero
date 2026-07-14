from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from analytics.models import DailyOrgStats
from orgs.models import OrgMembership, Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.mark.django_db
def test_stats_delta_defaults_to_7d_window(api, org, owner):
    today = timezone.localdate()
    DailyOrgStats.objects.create(
        org=org, date=today - timedelta(days=2), new_followers_count=2, profile_views_count=5
    )
    DailyOrgStats.objects.create(
        org=org, date=today - timedelta(days=10), new_followers_count=100, profile_views_count=100
    )  # outside the 7d window

    api.force_authenticate(owner)
    res = api.get(f"/api/orgs/{org.slug}/stats/")

    assert res.status_code == 200
    assert res.data["range_days"] == 7
    assert res.data["new_followers"] == 2
    assert res.data["profile_views"] == 5


@pytest.mark.django_db
def test_stats_delta_30d_range_includes_wider_window(api, org, owner):
    today = timezone.localdate()
    DailyOrgStats.objects.create(
        org=org, date=today - timedelta(days=10), new_followers_count=3, profile_views_count=7
    )

    api.force_authenticate(owner)
    res = api.get(f"/api/orgs/{org.slug}/stats/?range=30d")

    assert res.status_code == 200
    assert res.data["range_days"] == 30
    assert res.data["new_followers"] == 3
    assert res.data["profile_views"] == 7
