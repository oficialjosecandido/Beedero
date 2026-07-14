from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from accounts.models import User
from orgs.models import OrgFollow, Organization

from .models import DailyOrgStats, ProfileView


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.mark.django_db
def test_compute_daily_org_stats_snapshot_and_delta(org):
    yesterday = timezone.localdate() - timedelta(days=1)
    day_start = timezone.make_aware(timezone.datetime.combine(yesterday, timezone.datetime.min.time()))

    older_follower = User.objects.create_user(username="older", password="x")
    OrgFollow.objects.create(org=org, user=older_follower)
    OrgFollow.objects.filter(org=org, user=older_follower).update(created_at=day_start - timedelta(days=5))

    new_follower = User.objects.create_user(username="newf", password="x")
    OrgFollow.objects.create(org=org, user=new_follower)
    OrgFollow.objects.filter(org=org, user=new_follower).update(created_at=day_start + timedelta(hours=2))

    outside_follower = User.objects.create_user(username="outside", password="x")
    OrgFollow.objects.create(org=org, user=outside_follower)
    OrgFollow.objects.filter(org=org, user=outside_follower).update(created_at=day_start + timedelta(days=2))

    viewer = User.objects.create_user(username="viewer", password="x")
    ProfileView.objects.create(org=org, viewer=viewer)
    ProfileView.objects.filter(org=org, viewer=viewer).update(viewed_at=day_start + timedelta(hours=3))

    call_command("compute_daily_org_stats", date=yesterday.isoformat())

    stats = DailyOrgStats.objects.get(org=org, date=yesterday)
    assert stats.followers_count == 2  # cumulative as-of end of day: older + new, not outside
    assert stats.new_followers_count == 1  # only the one created that day
    assert stats.profile_views_count == 1


@pytest.mark.django_db
def test_compute_daily_org_stats_upserts_idempotently(org):
    yesterday = timezone.localdate() - timedelta(days=1)

    call_command("compute_daily_org_stats", date=yesterday.isoformat())
    call_command("compute_daily_org_stats", date=yesterday.isoformat())

    assert DailyOrgStats.objects.filter(org=org, date=yesterday).count() == 1
