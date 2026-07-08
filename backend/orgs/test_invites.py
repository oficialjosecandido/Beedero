from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import Organization, OrgInvite, OrgMembership


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", email="owner@acme.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def joiner(db):
    return User.objects.create_user(username="joiner", email="joiner@example.com", password="x")


@pytest.mark.django_db
def test_create_invite_with_expiry_and_cap(api, org, owner):
    api.force_authenticate(owner)
    expires_at = (timezone.now() + timedelta(days=7)).isoformat()
    res = api.post(f"/api/orgs/{org.slug}/invites/", {"expires_at": expires_at, "max_uses": 3})
    assert res.status_code == 201
    assert res.data["max_uses"] == 3
    assert res.data["is_active"] is True


@pytest.mark.django_db
def test_create_invite_rejects_invalid_max_uses(api, org, owner):
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/invites/", {"max_uses": 0})
    assert res.status_code == 400

    res = api.post(f"/api/orgs/{org.slug}/invites/", {"max_uses": "not-a-number"})
    assert res.status_code == 400


@pytest.mark.django_db
def test_create_invite_rejects_invalid_expires_at(api, org, owner):
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/invites/", {"expires_at": "not-a-date"})
    assert res.status_code == 400


@pytest.mark.django_db
def test_accept_expired_invite_is_rejected(api, org, owner, joiner):
    invite = OrgInvite.objects.create(
        org=org, created_by=owner, expires_at=timezone.now() - timedelta(minutes=1)
    )
    api.force_authenticate(joiner)
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 400
    assert "expired" in res.data["detail"]
    assert not OrgMembership.objects.filter(org=org, user=joiner).exists()


@pytest.mark.django_db
def test_accept_invite_at_usage_cap_is_rejected(api, org, owner, joiner):
    invite = OrgInvite.objects.create(org=org, created_by=owner, max_uses=1)
    first_user = User.objects.create_user(username="first", email="first@example.com", password="x")
    api.force_authenticate(first_user)
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 200

    api.force_authenticate(joiner)
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 400
    assert "usage limit" in res.data["detail"]
    assert not OrgMembership.objects.filter(org=org, user=joiner).exists()


@pytest.mark.django_db
def test_accept_within_cap_and_before_expiry_succeeds(api, org, owner, joiner):
    invite = OrgInvite.objects.create(
        org=org, created_by=owner, max_uses=2, expires_at=timezone.now() + timedelta(days=1)
    )
    api.force_authenticate(joiner)
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 200
    invite.refresh_from_db()
    assert invite.uses_count == 1


@pytest.mark.django_db
def test_repeat_accept_by_existing_member_does_not_double_count(api, org, owner, joiner):
    invite = OrgInvite.objects.create(org=org, created_by=owner, max_uses=1)
    api.force_authenticate(joiner)
    api.post(f"/api/invites/{invite.token}/accept/")
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 200
    invite.refresh_from_db()
    assert invite.uses_count == 1
