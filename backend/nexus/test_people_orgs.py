"""People and organisations: finding them, and what admins can change."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone
from firebase_admin import auth as firebase_auth

from accounts.ladder import verification_ladder, with_unlock
from accounts.models import InvestorProfile
from accounts.testing import unlock
from billing.access import has_access, org_billing_state
from billing.models import Subscription
from billing.subscriptions import grant_launch_year
from credibility.models import Verification, VerificationType
from nexus.models import NexusAction
from orgs.models import Organization, OrgMembership


@pytest.fixture
def ana(make_user):
    user = make_user("ana", email="ana@lumen.pt", firebase_uid="uid-ana")
    unlock(user, full_name="Ana Silva", handle="anasilva")
    return user


@pytest.fixture
def lumen(ana):
    org = Organization.objects.create(slug="lumen", name="Lumen Credit", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=ana, role=OrgMembership.Role.OWNER)
    return org


# ------------------------------------------------------------------ people


@pytest.mark.django_db
@pytest.mark.parametrize("q", ["ana@lumen", "Silva", "@anasilva"])
def test_people_can_be_found_by_email_name_or_handle(as_staff, ana, make_user, q):
    make_user("bob")
    rows = as_staff.get("/api/nexus/users/", {"q": q}).json()["results"]
    assert [row["email"] for row in rows] == ["ana@lumen.pt"]
    assert rows[0]["in_discover"] is True


@pytest.mark.django_db
def test_people_filters(as_staff, ana, lumen, make_user):
    make_user("tester", is_internal=True)
    make_user("gone", is_active=False)

    def emails(key):
        return {row["email"] for row in as_staff.get("/api/nexus/users/", {"filter": key}).json()["results"]}

    assert emails("founders") == {"ana@lumen.pt"}
    assert emails("internal") == {"tester@example.com"}
    assert emails("suspended") == {"gone@example.com"}
    assert "ana@lumen.pt" in emails("discover")


@pytest.mark.django_db
def test_a_person_in_full(as_staff, ana, lumen):
    body = as_staff.get(f"/api/nexus/users/{ana.id}/").json()
    assert body["name"] == "Ana Silva"
    assert body["orgs"] == [
        {"slug": "lumen", "name": "Lumen Credit", "role": "owner", "status": "live", "logo": None, "plan": "needs_plan"}
    ]
    assert body["ladder"]["percent"] >= 50
    assert body["can_manage"] is False


@pytest.mark.django_db
def test_staff_cannot_change_people(as_staff, ana):
    assert as_staff.post(f"/api/nexus/users/{ana.id}/suspend/", {"reason": "spam"}).status_code == 403
    ana.refresh_from_db()
    assert ana.is_active


@pytest.mark.django_db
def test_suspending_needs_a_reason_and_is_recorded(as_admin, admin, ana):
    assert as_admin.post(f"/api/nexus/users/{ana.id}/suspend/", {}).status_code == 400
    response = as_admin.post(f"/api/nexus/users/{ana.id}/suspend/", {"reason": "Scam messages"}, format="json")
    assert response.status_code == 200
    ana.refresh_from_db()
    assert ana.is_active is False
    action = NexusAction.objects.get(action="user.suspended")
    assert (action.actor, action.target_id, action.reason) == (admin, str(ana.id), "Scam messages")
    assert mail.outbox[-1].to == ["ana@lumen.pt"]
    assert "suspended" in mail.outbox[-1].subject


@pytest.mark.django_db
def test_a_suspended_person_leaves_discover_and_their_page(as_admin, api, ana):
    as_admin.post(f"/api/nexus/users/{ana.id}/suspend/", {"reason": "Scam"}, format="json")
    assert not with_unlock(InvestorProfile.objects.filter(user=ana)).exists()
    api.force_authenticate(None)
    assert api.get("/api/public/people/anasilva/").status_code == 404


@pytest.mark.django_db
def test_a_suspended_person_cannot_sign_in(api, ana):
    ana.is_active = False
    ana.save()
    claims = {"uid": "uid-ana", "email": "ana@lumen.pt", "email_verified": True}
    with patch("accounts.firebase_auth.get_firebase_app", return_value=object()), patch.object(
        firebase_auth, "verify_id_token", return_value=claims
    ):
        api.credentials(HTTP_AUTHORIZATION="Bearer fake.jwt.token")
        response = api.get("/api/auth/me/")
    assert response.status_code == 403
    assert response.json()["code"] == "account_suspended"


@pytest.mark.django_db
def test_nobody_suspends_themselves_or_other_staff(as_admin, admin, staff):
    assert as_admin.post(f"/api/nexus/users/{admin.id}/suspend/", {"reason": "x"}).status_code == 400
    assert as_admin.post(f"/api/nexus/users/{staff.id}/suspend/", {"reason": "x"}).status_code == 400


@pytest.mark.django_db
def test_reactivating_brings_them_back(as_admin, ana):
    as_admin.post(f"/api/nexus/users/{ana.id}/suspend/", {"reason": "Scam"}, format="json")
    as_admin.post(f"/api/nexus/users/{ana.id}/reactivate/", {"reason": "Appeal accepted"}, format="json")
    ana.refresh_from_db()
    assert ana.is_active
    assert with_unlock(InvestorProfile.objects.filter(user=ana)).exists()


@pytest.mark.django_db
def test_beedero_verification_is_the_ladder_rung(as_admin, ana):
    as_admin.post(f"/api/nexus/users/{ana.id}/verify/", {"value": True, "reason": "Checked LinkedIn and registry"}, format="json")
    ana.investorprofile.refresh_from_db()
    rung = next(r for r in verification_ladder(ana.investorprofile)["rungs"] if r["key"] == "beedero_verified")
    assert rung["done"] is True


@pytest.mark.django_db
def test_internal_accounts_leave_the_numbers(as_admin, ana):
    before = as_admin.get("/api/nexus/overview/").json()
    people = next(c for s in before["sections"] for c in s["cards"] if c["key"] == "people_total")["value"]
    as_admin.post(f"/api/nexus/users/{ana.id}/internal/", {"value": True}, format="json")
    after = as_admin.get("/api/nexus/overview/").json()
    assert next(c for s in after["sections"] for c in s["cards"] if c["key"] == "people_total")["value"] == people - 1


# ----------------------------------------------------------- organisations


@pytest.mark.django_db
def test_organisation_filters_by_plan(as_staff, lumen, ana):
    other = Organization.objects.create(slug="tidal", name="Tidal")
    grant_launch_year(other)

    def slugs(key):
        return {row["slug"] for row in as_staff.get("/api/nexus/orgs/", {"filter": key}).json()["results"]}

    assert slugs("no_plan") == {"lumen"}
    assert slugs("free_year") == {"tidal"}
    assert slugs("live") == {"lumen"}


@pytest.mark.django_db
def test_an_organisation_in_full_never_shows_the_registry_code(as_staff, lumen, ana):
    Verification.objects.create(
        org=lumen, type=VerificationType.COMPANY_REGISTRY, payload={"access_code": "1234-5678-9012"}, submitted_by=ana
    )
    response = as_staff.get("/api/nexus/orgs/lumen/")
    body = response.json()
    assert body["verifications"][0]["status"] == "pending"
    assert "1234-5678-9012" not in response.content.decode()
    assert body["members"][0]["role"] == "owner"


@pytest.mark.django_db
def test_complimentary_plan_on_and_off(as_admin, lumen):
    as_admin.post("/api/nexus/orgs/lumen/comp/", {"value": True, "reason": "Partner"}, format="json")
    assert org_billing_state(lumen)["state"] == "comp"
    as_admin.post("/api/nexus/orgs/lumen/comp/", {"value": False, "reason": "Partnership ended"}, format="json")
    assert has_access(lumen) is False


@pytest.mark.django_db
def test_extending_a_running_free_year(as_admin, lumen):
    sub = grant_launch_year(lumen)
    end = sub.trial_end
    as_admin.post("/api/nexus/orgs/lumen/extend/", {"days": 30, "reason": "Late launch"}, format="json")
    sub.refresh_from_db()
    assert sub.trial_end == end + timedelta(days=30)


@pytest.mark.django_db
def test_extending_with_no_free_period_starts_one(as_admin, lumen):
    as_admin.post("/api/nexus/orgs/lumen/extend/", {"days": 60, "reason": "Pilot"}, format="json")
    row = Subscription.objects.get(org=lumen)
    assert (row.source, row.status) == ("admin", "trialing")
    assert abs(row.trial_end - (timezone.now() + timedelta(days=60))) < timedelta(minutes=1)


@pytest.mark.django_db
def test_a_stripe_subscription_is_changed_in_stripe(as_admin, lumen):
    Subscription.objects.create(org=lumen, plan="org_yearly", status="active", source="checkout", provider_ref="sub_1")
    response = as_admin.post("/api/nexus/orgs/lumen/extend/", {"days": 30, "reason": "x"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_staff_cannot_change_organisations(as_staff, lumen):
    assert as_staff.post("/api/nexus/orgs/lumen/comp/", {"value": True, "reason": "x"}).status_code == 403
