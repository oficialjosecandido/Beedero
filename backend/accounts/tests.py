from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from analytics.models import ActivityFeedImpression, PersonProfileView
from connections.models import Connection
from orgs.models import Activity, Organization, OrgMembership


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
    assert put_res.data["handle"] == "adalovelace"


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
def test_investor_posts_include_engagement_metrics(api, user):
    from social.models import Reaction

    activity = Activity.objects.create(
        author=user,
        org=None,
        kind="update",
        title="Hello",
        body="World",
        occurred_at=timezone.now(),
        reaction_count=2,
        feed_impression_count=5,
    )
    Reaction.objects.create(activity=activity, user=user, kind=Reaction.Kind.LIKE)

    api.force_authenticate(user)
    res = api.get("/api/investors/me/posts/")
    assert res.status_code == 200
    assert len(res.data) == 1
    post = res.data[0]
    assert post["reaction_count"] == 2
    assert post["reaction_counts"]["like"] == 1
    assert post["feed_impression_count"] == 5


@pytest.mark.django_db
def test_investor_stats_returns_profile_kpis(api, user):
    from social.models import Reaction

    connected_user = User.objects.create_user(
        username="connected@example.com", email="connected@example.com", password="pw"
    )
    first, second = sorted([connected_user, user], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)
    activity = Activity.objects.create(
        author=user,
        org=None,
        kind="update",
        title="Hello",
        body="",
        occurred_at=timezone.now(),
        reaction_count=3,
    )
    for i, kind in enumerate((Reaction.Kind.LIKE, Reaction.Kind.INSIGHT, Reaction.Kind.CONGRATS)):
        reactor = User.objects.create_user(
            username=f"reactor{i}@example.com",
            email=f"reactor{i}@example.com",
            password="pw",
        )
        Reaction.objects.create(activity=activity, user=reactor, kind=kind)

    api.force_authenticate(user)
    res = api.get("/api/investors/me/stats/")
    assert res.status_code == 200
    assert res.data["connections_count"] == 1
    assert res.data["new_connections"] == 1
    assert res.data["posts_count"] == 1
    assert res.data["reactions_received"] == 3
    assert res.data["range_days"] == 7


@pytest.mark.django_db
def test_investor_stats_profile_views_and_impressions_are_windowed_to_range_days(api, user):
    viewer = User.objects.create_user(
        username="viewer@example.com", email="viewer@example.com", password="pw"
    )
    post = Activity.objects.create(
        author=user, org=None, kind="update", title="Hello", body="", occurred_at=timezone.now()
    )

    old = timezone.now() - timedelta(days=10)
    recent = timezone.now() - timedelta(days=1)

    old_view = PersonProfileView.objects.create(subject=user, viewer=viewer)
    PersonProfileView.objects.filter(pk=old_view.pk).update(viewed_at=old)
    recent_view = PersonProfileView.objects.create(subject=user, viewer=viewer)
    PersonProfileView.objects.filter(pk=recent_view.pk).update(viewed_at=recent)

    old_impression = ActivityFeedImpression.objects.create(activity=post, viewer=viewer)
    ActivityFeedImpression.objects.filter(pk=old_impression.pk).update(viewed_at=old)

    api.force_authenticate(user)
    res = api.get("/api/investors/me/stats/")
    assert res.status_code == 200
    assert res.data["range_days"] == 7
    # Only the view/impression inside the last 7 days counts.
    assert res.data["profile_views_count"] == 1
    assert res.data["post_impressions_count"] == 0

    res_30d = api.get("/api/investors/me/stats/?range=30d")
    assert res_30d.data["range_days"] == 30
    assert res_30d.data["profile_views_count"] == 2


@pytest.mark.django_db
def test_self_declared_experience_create_and_list(api, user):
    api.force_authenticate(user)
    res = api.post(
        "/api/experience/",
        {"org_name": "Old Startup Inc", "role": "Founder", "started_on": "2018-01-01"},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["org_name"] == "Old Startup Inc"

    res = api.get("/api/experience/")
    assert res.status_code == 200
    assert len(res.data) == 1


@pytest.mark.django_db
def test_self_declared_experience_rejects_ended_before_started(api, user):
    api.force_authenticate(user)
    res = api.post(
        "/api/experience/",
        {"org_name": "Old Startup Inc", "started_on": "2018-01-01", "ended_on": "2017-01-01"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_self_declared_experience_owner_only_edit(api, user):
    other = User.objects.create_user(username="other3", email="other3@example.com", password="x")
    api.force_authenticate(user)
    created = api.post(
        "/api/experience/", {"org_name": "Old Startup Inc", "started_on": "2018-01-01"}, format="json"
    )
    experience_id = created.data["id"]

    api.force_authenticate(other)
    res = api.patch(f"/api/experience/{experience_id}/", {"org_name": "Hijacked"}, format="json")
    assert res.status_code == 404

    res = api.delete(f"/api/experience/{experience_id}/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_self_declared_experience_delete(api, user):
    api.force_authenticate(user)
    created = api.post(
        "/api/experience/", {"org_name": "Old Startup Inc", "started_on": "2018-01-01"}, format="json"
    )
    experience_id = created.data["id"]
    res = api.delete(f"/api/experience/{experience_id}/")
    assert res.status_code == 204


@pytest.mark.django_db
def test_delete_account_removes_user(api, user):
    api.force_authenticate(user)
    res = api.delete("/api/auth/me/")
    assert res.status_code == 204
    assert not User.objects.filter(id=user.id).exists()


@pytest.mark.django_db
def test_delete_account_deletes_sole_owner_org(api, user):
    org = Organization.objects.create(slug="solo-inc", name="Solo Inc")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)

    api.force_authenticate(user)
    res = api.delete("/api/auth/me/")

    assert res.status_code == 204
    assert not Organization.objects.filter(id=org.id).exists()


@pytest.mark.django_db
def test_delete_account_preserves_org_with_other_owner(api, user):
    other_owner = User.objects.create_user(username="co-owner", email="co-owner@example.com", password="x")
    org = Organization.objects.create(slug="duo-inc", name="Duo Inc")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    OrgMembership.objects.create(org=org, user=other_owner, role=OrgMembership.Role.OWNER)
    deleted_user_id = user.id

    api.force_authenticate(user)
    res = api.delete("/api/auth/me/")

    assert res.status_code == 204
    org.refresh_from_db()
    assert OrgMembership.objects.filter(org=org, user=other_owner).exists()
    assert not OrgMembership.objects.filter(org=org, user_id=deleted_user_id).exists()


@pytest.mark.django_db
def test_delete_account_removes_membership_when_not_sole_owner(api, user):
    org = Organization.objects.create(slug="member-inc", name="Member Inc")
    other_owner = User.objects.create_user(username="owner2", email="owner2@example.com", password="x")
    OrgMembership.objects.create(org=org, user=other_owner, role=OrgMembership.Role.OWNER)
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
    deleted_user_id = user.id

    api.force_authenticate(user)
    res = api.delete("/api/auth/me/")

    assert res.status_code == 204
    org.refresh_from_db()
    assert not OrgMembership.objects.filter(org=org, user_id=deleted_user_id).exists()
