from datetime import date

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import MembershipSkill, Organization, OrgMembership


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
def member(db, org):
    user = User.objects.create_user(username="member", email="member@acme.com", password="x")
    membership = OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
    return user, membership


@pytest.mark.django_db
def test_member_can_declare_own_skill(api, org, member):
    user, membership = member
    api.force_authenticate(user)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": "React"})
    assert res.status_code == 201
    assert res.data["skill"] == "React"
    assert res.data["status"] == "declared"


@pytest.mark.django_db
def test_other_user_cannot_declare_skill_for_member(api, org, member):
    user, membership = member
    other = User.objects.create_user(username="other", email="other@example.com", password="x")
    api.force_authenticate(other)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": "React"})
    assert res.status_code == 403
    assert not MembershipSkill.objects.filter(membership=membership).exists()


@pytest.mark.django_db
def test_declaring_duplicate_skill_case_insensitively_rejected(api, org, member):
    user, membership = member
    api.force_authenticate(user)
    api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": "React"})
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": "react"})
    assert res.status_code == 400
    assert MembershipSkill.objects.filter(membership=membership).count() == 1


@pytest.mark.django_db
def test_member_can_delete_own_declared_skill(api, org, member):
    user, membership = member
    skill = MembershipSkill.objects.create(membership=membership, skill="React")
    api.force_authenticate(user)
    res = api.delete(f"/api/orgs/{org.slug}/members/{membership.id}/skills/{skill.id}/")
    assert res.status_code == 204
    assert not MembershipSkill.objects.filter(id=skill.id).exists()


@pytest.mark.django_db
def test_owner_can_confirm_a_declared_skill(api, org, owner, member):
    user, membership = member
    skill = MembershipSkill.objects.create(membership=membership, skill="React")
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/{skill.id}/confirm/")
    assert res.status_code == 200
    skill.refresh_from_db()
    assert skill.status == MembershipSkill.Status.ORG_CONFIRMED
    assert skill.confirmed_at is not None


@pytest.mark.django_db
def test_non_admin_cannot_confirm_a_declared_skill(api, org, member):
    user, membership = member
    skill = MembershipSkill.objects.create(membership=membership, skill="React")
    other = User.objects.create_user(username="other2", email="other2@example.com", password="x")
    OrgMembership.objects.create(org=org, user=other, role=OrgMembership.Role.MEMBER)
    api.force_authenticate(other)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/{skill.id}/confirm/")
    assert res.status_code == 403
    skill.refresh_from_db()
    assert skill.status == MembershipSkill.Status.DECLARED


@pytest.mark.django_db
def test_skill_cap_enforced(api, org, member):
    user, membership = member
    api.force_authenticate(user)
    for i in range(10):
        res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": f"skill{i}"})
        assert res.status_code == 201
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/skills/", {"skill": "one-too-many"})
    assert res.status_code == 400
    assert MembershipSkill.objects.filter(membership=membership).count() == 10


@pytest.mark.django_db
def test_org_membership_started_ended_on_patch(api, org, owner, member):
    _, membership = member
    api.force_authenticate(owner)
    res = api.patch(
        f"/api/orgs/{org.slug}/members/{membership.id}/",
        {"started_on": "2020-01-01", "ended_on": "2021-01-01"},
        format="json",
    )
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.started_on.isoformat() == "2020-01-01"
    assert membership.ended_on.isoformat() == "2021-01-01"


@pytest.mark.django_db
def test_org_membership_ended_on_can_be_cleared(api, org, owner, member):
    _, membership = member
    membership.ended_on = date(2021, 1, 1)
    membership.save(update_fields=["ended_on"])
    api.force_authenticate(owner)
    res = api.patch(
        f"/api/orgs/{org.slug}/members/{membership.id}/", {"ended_on": None}, format="json"
    )
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.ended_on is None
