from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import InvestorProfile
from notifications.models import Notification
from orgs.models import Organization, OrgInvite, OrgMembership

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    user = User.objects.create_user(username="owner", email="owner@ex.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="Owner Person", handle="ownerperson")
    return user


@pytest.fixture
def member(db):
    user = User.objects.create_user(username="member", email="member@ex.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="Member Person", handle="memberperson")
    return user


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER, title="CEO")
    return org


@pytest.mark.django_db
def test_member_edit_demotes_details_and_notifies_admins(api, org, owner, member):
    membership = OrgMembership.objects.create(
        org=org,
        user=member,
        role=OrgMembership.Role.MEMBER,
        title="Engineer",
        started_on=date(2024, 1, 1),
        details_status=OrgMembership.DetailsStatus.CONFIRMED,
    )
    api.force_authenticate(member)
    res = api.patch(
        f"/api/orgs/{org.slug}/members/{membership.id}/",
        {
            "as_member": True,
            "title": "Senior Engineer",
            "description": "Built the payments stack.",
            "started_on": "2023-06-01",
            "ended_on": None,
            "skills": ["Python", "React"],
        },
        format="json",
    )
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.title == "Senior Engineer"
    assert membership.description == "Built the payments stack."
    assert membership.details_status == OrgMembership.DetailsStatus.PENDING
    # The old attestation was for the old details and does not carry over.
    assert membership.details_confirmed_by_id is None
    assert membership.details_confirmed_at is None
    assert membership.attested_by_other is False
    assert set(membership.skills_used.values_list("skill", flat=True)) == {"Python", "React"}
    assert Notification.objects.filter(
        user=owner, aggregate_key=f"membership_details:{membership.id}"
    ).exists()


@pytest.mark.django_db
def test_admin_confirm_restores_verified_badge(api, org, owner, member):
    membership = OrgMembership.objects.create(
        org=org,
        user=member,
        role=OrgMembership.Role.MEMBER,
        title="Engineer",
        started_on=date(2024, 1, 1),
        details_status=OrgMembership.DetailsStatus.PENDING,
    )
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/confirm-details/")
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.details_status == OrgMembership.DetailsStatus.CONFIRMED
    assert membership.details_confirmed_by_id == owner.id
    assert membership.details_confirmed_at is not None
    assert membership.attested_by_other is True


@pytest.mark.django_db
def test_admin_title_edit_keeps_confirmed(api, org, owner, member):
    membership = OrgMembership.objects.create(
        org=org,
        user=member,
        role=OrgMembership.Role.MEMBER,
        title="Engineer",
        started_on=date(2024, 1, 1),
        details_status=OrgMembership.DetailsStatus.PENDING,
    )
    api.force_authenticate(owner)
    res = api.patch(
        f"/api/orgs/{org.slug}/members/{membership.id}/",
        {"title": "Lead Engineer"},
        format="json",
    )
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.title == "Lead Engineer"
    assert membership.details_status == OrgMembership.DetailsStatus.CONFIRMED
    assert membership.details_confirmed_by_id == owner.id
    assert membership.attested_by_other is True


@pytest.mark.django_db
def test_an_admin_confirming_their_own_row_is_not_attestation(api, org, owner):
    """The owner is an admin of their own org, so nothing stops them clicking
    confirm on their own details — it just must not read as the organisation
    vouching for them (accounts/ladder.py, rung 6)."""
    membership = OrgMembership.objects.get(org=org, user=owner)
    membership.details_status = OrgMembership.DetailsStatus.PENDING
    membership.save(update_fields=["details_status"])
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/members/{membership.id}/confirm-details/")
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.details_status == OrgMembership.DetailsStatus.CONFIRMED
    assert membership.details_confirmed_by_id == owner.id
    assert membership.attested_by_other is False


@pytest.mark.django_db
def test_creating_an_org_only_self_attests_the_founder(api, member):
    api.force_authenticate(member)
    res = api.post("/api/orgs/", {"name": "Bidroom"}, format="json")
    assert res.status_code == 201
    membership = OrgMembership.objects.get(org__slug=res.data["slug"], user=member)
    assert membership.details_status == OrgMembership.DetailsStatus.CONFIRMED
    assert membership.details_confirmed_by_id == member.id
    assert membership.attested_by_other is False


@pytest.mark.django_db
def test_accepting_an_invite_attests_to_whoever_wrote_it(api, org, owner, member):
    invite = OrgInvite.objects.create(
        org=org, role=OrgMembership.Role.MEMBER, created_by=owner, max_uses=1
    )
    api.force_authenticate(member)
    res = api.post(f"/api/invites/{invite.token}/accept/")
    assert res.status_code == 200
    membership = OrgMembership.objects.get(org=org, user=member)
    assert membership.details_confirmed_by_id == owner.id
    assert membership.attested_by_other is True
