from datetime import date

import pytest
from django.contrib.messages.storage.fallback import FallbackStorage
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from notifications.models import Notification
from orgs.models import Organization, OrgMembership

from .admin import AffiliationAdmin
from .models import Affiliation, RoleType
from .services import (
    accept_affiliation,
    confirm_affiliation,
    declare_affiliation,
    dispute_affiliation,
    dispute_founder,
    org_add_affiliation,
    verify_founder_via_registry,
    withdraw_affiliation,
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", email="owner@example.com", password="x")


@pytest.fixture
def person(db):
    return User.objects.create_user(username="person", email="person@example.com", password="x")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


@pytest.fixture
def draft_org(db, owner):
    org = Organization.objects.create(slug="draftco", name="DraftCo", status=Organization.Status.DRAFT)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


@pytest.mark.django_db
def test_founder_declare_is_self_declared_with_no_notification(org, person):
    affiliation = declare_affiliation(
        person, org, role=RoleType.FOUNDER, started_on=date(2024, 1, 1)
    )
    assert affiliation.status == Affiliation.Status.SELF_DECLARED
    assert not Notification.objects.filter(kind=Notification.Kind.AFFILIATION_REQUEST).exists()


@pytest.mark.django_db
def test_non_founder_declare_is_pending_and_notifies_admins(org, owner, person):
    affiliation = declare_affiliation(
        person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1)
    )
    assert affiliation.status == Affiliation.Status.PENDING
    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.AFFILIATION_REQUEST
    ).exists()


@pytest.mark.django_db
def test_declare_requires_live_org(draft_org, person):
    with pytest.raises(ValidationError):
        declare_affiliation(person, draft_org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))


@pytest.mark.django_db
def test_declare_rejects_duplicate_active_claim(org, person):
    declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    with pytest.raises(ValidationError):
        declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))


@pytest.mark.django_db
def test_org_add_rejects_founder_role(org, owner, person):
    with pytest.raises(ValidationError):
        org_add_affiliation(owner, org, person, role=RoleType.FOUNDER, started_on=date(2024, 1, 1))


@pytest.mark.django_db
def test_confirm_only_works_on_person_initiated_pending(org, owner, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    confirmed = confirm_affiliation(affiliation, owner)
    assert confirmed.status == Affiliation.Status.VERIFIED
    assert confirmed.verified_via == Affiliation.VerifiedVia.ORG


@pytest.mark.django_db
def test_confirm_rejects_org_added_affiliation(org, owner, person):
    affiliation = org_add_affiliation(owner, org, person, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    with pytest.raises(ValidationError):
        confirm_affiliation(affiliation, owner)


@pytest.mark.django_db
def test_confirm_rejects_founder_role(org, owner, person):
    affiliation = Affiliation.objects.create(
        user=person, org=org, role=RoleType.FOUNDER, started_on=date(2024, 1, 1),
        status=Affiliation.Status.PENDING, created_by=person,
    )
    with pytest.raises(ValidationError):
        confirm_affiliation(affiliation, owner)


@pytest.mark.django_db
def test_dispute_sets_disputed_and_notifies_person(org, owner, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    disputed = dispute_affiliation(affiliation, owner)
    assert disputed.status == Affiliation.Status.DISPUTED
    assert Notification.objects.filter(user=person, kind=Notification.Kind.AFFILIATION_UPDATE).exists()


@pytest.mark.django_db
def test_accept_only_works_on_org_added_row_for_correct_user(org, owner, person):
    affiliation = org_add_affiliation(owner, org, person, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    accepted = accept_affiliation(affiliation, person)
    assert accepted.status == Affiliation.Status.VERIFIED


@pytest.mark.django_db
def test_accept_rejects_person_initiated_declaration(org, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    with pytest.raises(ValidationError):
        accept_affiliation(affiliation, person)


@pytest.mark.django_db
def test_accept_rejects_wrong_user(org, owner, person):
    other = User.objects.create_user(username="other", email="other@example.com", password="x")
    affiliation = org_add_affiliation(owner, org, person, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    with pytest.raises(PermissionDenied):
        accept_affiliation(affiliation, other)


@pytest.mark.django_db
def test_withdraw_blocked_once_verified(org, owner, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    confirm_affiliation(affiliation, owner)
    with pytest.raises(ValidationError):
        withdraw_affiliation(affiliation, person)


@pytest.mark.django_db
def test_withdraw_deletes_pending_row(org, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    withdraw_affiliation(affiliation, person)
    assert not Affiliation.objects.filter(id=affiliation.id).exists()


@pytest.mark.django_db
def test_verify_founder_via_registry_requires_founder_role(org, owner, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    with pytest.raises(ValidationError):
        verify_founder_via_registry(affiliation, reviewer=owner)


def _admin_request(rf, user):
    request = rf.post("/admin/affiliations/affiliation/")
    request.user = user
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


@pytest.mark.django_db
def test_admin_action_verifies_founder(org, owner, person, rf):
    affiliation = declare_affiliation(person, org, role=RoleType.FOUNDER, started_on=date(2024, 1, 1))
    admin = AffiliationAdmin(Affiliation, None)
    admin.mark_founder_verified(_admin_request(rf, owner), Affiliation.objects.filter(id=affiliation.id))
    affiliation.refresh_from_db()
    assert affiliation.status == Affiliation.Status.VERIFIED
    assert affiliation.verified_via == Affiliation.VerifiedVia.REGISTRY


@pytest.mark.django_db
def test_admin_action_disputes_founder(org, owner, person, rf):
    affiliation = declare_affiliation(person, org, role=RoleType.FOUNDER, started_on=date(2024, 1, 1))
    admin = AffiliationAdmin(Affiliation, None)
    admin.mark_founder_disputed(_admin_request(rf, owner), Affiliation.objects.filter(id=affiliation.id))
    affiliation.refresh_from_db()
    assert affiliation.status == Affiliation.Status.DISPUTED


@pytest.mark.django_db
def test_admin_action_ignores_non_founder_rows(org, owner, person, rf):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    admin = AffiliationAdmin(Affiliation, None)
    admin.mark_founder_verified(_admin_request(rf, owner), Affiliation.objects.filter(id=affiliation.id))
    affiliation.refresh_from_db()
    assert affiliation.status == Affiliation.Status.PENDING


@pytest.mark.django_db
def test_org_affiliations_endpoint_requires_admin(api, org, person):
    declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    api.force_authenticate(person)
    res = api.get(f"/api/orgs/{org.slug}/affiliations/")
    assert res.status_code == 403


@pytest.mark.django_db
def test_confirm_endpoint_verifies_pending_affiliation(api, org, owner, person):
    affiliation = declare_affiliation(person, org, role=RoleType.EMPLOYEE, started_on=date(2024, 1, 1))
    api.force_authenticate(owner)
    res = api.post(f"/api/orgs/{org.slug}/affiliations/{affiliation.id}/confirm/")
    assert res.status_code == 200
    assert res.data["status"] == Affiliation.Status.VERIFIED


@pytest.mark.django_db
def test_org_search_endpoint_filters_to_live_orgs(api, org, draft_org, person):
    api.force_authenticate(person)
    res = api.get("/api/orgs/search/?q=a")  # matches both "Acme" and "DraftCo"
    slugs = {item["slug"] for item in res.data["items"]}
    assert org.slug in slugs
    assert draft_org.slug not in slugs


@pytest.mark.django_db
def test_org_search_endpoint_requires_auth(api):
    res = api.get("/api/orgs/search/?q=acme")
    assert res.status_code == 401
