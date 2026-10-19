from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import InvestorProfile
from notifications.models import Notification
from orgs.models import Organization, OrgMembership

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
            "started_on": "2023-06-01",
            "ended_on": None,
        },
        format="json",
    )
    assert res.status_code == 200
    membership.refresh_from_db()
    assert membership.title == "Senior Engineer"
    assert membership.details_status == OrgMembership.DetailsStatus.PENDING
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
