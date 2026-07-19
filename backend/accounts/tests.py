from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs.models import Activity, UserFollow


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="rl@example.com", email="rl@example.com", password="correct-horse-1")


@pytest.mark.django_db
def test_investor_profile_get_creates_then_put_updates(api, user):
    api.force_authenticate(user)
    get_res = api.get("/api/investors/me/")
    assert get_res.status_code == 200
    assert InvestorProfile.objects.filter(user=user).exists()
    assert not get_res.data["handle"]
    assert get_res.data["has_public_handle"] is False
    assert get_res.data["is_complete"] is False

    put_res = api.put(
        "/api/investors/me/",
        {"full_name": "Ada Lovelace", "headline": "Angel investor", "country": "GB"},
        format="json",
    )
    assert put_res.status_code == 200
    assert put_res.data["is_complete"] is True
    assert put_res.data["full_name"] == "Ada Lovelace"
    assert put_res.data["handle"] == "ada-lovelace"


@pytest.mark.django_db
def test_investor_profile_verification_fields_are_read_only(api, user):
    api.force_authenticate(user)
    res = api.put("/api/investors/me/", {"is_verified": True}, format="json")
    assert res.status_code == 200
    assert res.data["is_verified"] is False


@pytest.mark.django_db
def test_investor_post_create_and_daily_limit(api, user):
    api.force_authenticate(user)
    payload = {"kind": "update", "title": "Shipped v1", "occurred_at": timezone.now().isoformat()}
    first = api.post("/api/investors/me/posts/", payload, format="json")
    assert first.status_code == 201
    assert Activity.objects.filter(author=user, org__isnull=True).count() == 1

    second = api.post(
        "/api/investors/me/posts/",
        {**payload, "title": "Another one same day"},
        format="json",
    )
    assert second.status_code == 400
    assert Activity.objects.filter(author=user, org__isnull=True).count() == 1


@pytest.mark.django_db
def test_investor_post_allowed_again_the_next_day(api, user):
    api.force_authenticate(user)
    payload = {"kind": "update", "title": "Day one", "occurred_at": timezone.now().isoformat()}
    api.post("/api/investors/me/posts/", payload, format="json")
    Activity.objects.filter(author=user, org__isnull=True).update(
        created_at=timezone.now() - timedelta(days=1)
    )

    res = api.post(
        "/api/investors/me/posts/",
        {**payload, "title": "Day two"},
        format="json",
    )
    assert res.status_code == 201
    assert Activity.objects.filter(author=user, org__isnull=True).count() == 2


@pytest.mark.django_db
def test_me_view_reports_profile_and_memberships(api, user):
    api.force_authenticate(user)
    res = api.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["email"] == user.email
    assert res.data["is_email_verified"] is False
    assert res.data["memberships"] == []


@pytest.mark.django_db
def test_investor_stats_returns_profile_kpis(api, user):
    follower = User.objects.create_user(
        username="follower@example.com", email="follower@example.com", password="pw"
    )
    UserFollow.objects.create(follower=follower, followed=user)
    Activity.objects.create(
        author=user,
        org=None,
        kind="update",
        title="Hello",
        body="",
        occurred_at=timezone.now(),
        reaction_count=3,
    )

    api.force_authenticate(user)
    res = api.get("/api/investors/me/stats/")
    assert res.status_code == 200
    assert res.data["followers_count"] == 1
    assert res.data["following_count"] == 0
    assert res.data["new_followers"] == 1
    assert res.data["posts_count"] == 1
    assert res.data["reactions_received"] == 3
