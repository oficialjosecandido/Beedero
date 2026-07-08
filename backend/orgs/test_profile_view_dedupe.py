from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from analytics.models import ProfileView
from orgs.models import Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def viewer(db):
    return User.objects.create_user(username="viewer", email="viewer@example.com", password="x")


@pytest.mark.django_db
def test_repeat_view_within_window_does_not_create_new_row(api, org, viewer):
    api.force_authenticate(viewer)
    api.get(f"/api/orgs/{org.slug}/")
    api.get(f"/api/orgs/{org.slug}/")
    assert ProfileView.objects.filter(org=org, viewer=viewer).count() == 1


@pytest.mark.django_db
def test_view_after_dedupe_window_creates_new_row(api, org, viewer):
    old = ProfileView.objects.create(org=org, viewer=viewer)
    ProfileView.objects.filter(pk=old.pk).update(viewed_at=timezone.now() - timedelta(hours=25))

    api.force_authenticate(viewer)
    api.get(f"/api/orgs/{org.slug}/")

    assert ProfileView.objects.filter(org=org, viewer=viewer).count() == 2


@pytest.mark.django_db
def test_different_viewers_each_get_their_own_row(api, org, viewer):
    other = User.objects.create_user(username="other", email="other@example.com", password="x")
    api.force_authenticate(viewer)
    api.get(f"/api/orgs/{org.slug}/")
    api.force_authenticate(other)
    api.get(f"/api/orgs/{org.slug}/")

    assert ProfileView.objects.filter(org=org).count() == 2
