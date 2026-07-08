from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from accounts.models import User
from analytics.models import ProfileView
from orgs.models import Organization


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def viewer(db):
    return User.objects.create_user(username="viewer", email="viewer@example.com", password="x")


@pytest.mark.django_db
def test_prune_deletes_only_rows_past_retention(org, viewer):
    old = ProfileView.objects.create(org=org, viewer=viewer)
    ProfileView.objects.filter(pk=old.pk).update(viewed_at=timezone.now() - timedelta(days=200))
    recent = ProfileView.objects.create(org=org, viewer=viewer)

    call_command("prune_profile_views", stdout=StringIO())

    remaining = list(ProfileView.objects.all())
    assert remaining == [recent]


@pytest.mark.django_db
def test_prune_respects_custom_days(org, viewer):
    row = ProfileView.objects.create(org=org, viewer=viewer)
    ProfileView.objects.filter(pk=row.pk).update(viewed_at=timezone.now() - timedelta(days=10))

    call_command("prune_profile_views", days=30, stdout=StringIO())
    assert ProfileView.objects.count() == 1

    call_command("prune_profile_views", days=5, stdout=StringIO())
    assert ProfileView.objects.count() == 0
