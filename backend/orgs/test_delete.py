"""Deleting an organisation: DELETE /api/orgs/<slug>/.

The rules worth protecting: only an owner, only with the name typed, it works
without a plan, the Stripe subscription is cancelled first, and the invoicing
record survives.
"""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import PaidInvoice, Subscription
from billing.testing import grant_plan
from orgs.models import Organization, OrgMembership


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner@acme.com", email="owner@acme.com", password="x")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(name="Acme Freight", slug="acme-freight")
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    grant_plan(org)
    return org


def _member(org, email, role):
    user = User.objects.create_user(username=email, email=email, password="x")
    OrgMembership.objects.create(org=org, user=user, role=role)
    return user


class RecordingGateway:
    """Stands in for Stripe: records what was cancelled, fails on demand."""

    def __init__(self, fail=False):
        self.cancelled = []
        self.fail = fail

    def cancel_subscription(self, ref):
        if self.fail:
            raise RuntimeError("Stripe is unreachable")
        self.cancelled.append(ref)


@pytest.fixture
def gateway(monkeypatch):
    recorder = RecordingGateway()
    monkeypatch.setattr("billing.subscriptions.get_gateway", lambda: recorder)
    return recorder


@pytest.mark.django_db
def test_an_owner_deletes_the_organisation_by_typing_its_name(api, owner, org):
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 204
    assert not Organization.objects.filter(pk=org.pk).exists()
    # The plan rows go with it — access is computed from them.
    assert not Subscription.objects.filter(org_id=org.pk).exists()


@pytest.mark.django_db
def test_the_name_is_matched_loosely_enough_to_be_typed_by_hand(api, owner, org):
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "  acme freight "}, format="json")
    assert res.status_code == 204


@pytest.mark.django_db
def test_the_wrong_name_deletes_nothing(api, owner, org):
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme"}, format="json")
    assert res.status_code == 400
    assert "Acme Freight" in res.data["confirm"]
    assert Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_no_confirmation_at_all_deletes_nothing(api, owner, org):
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/")
    assert res.status_code == 400
    assert Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_an_admin_cannot_delete_the_organisation(api, org):
    admin = _member(org, "admin@acme.com", OrgMembership.Role.ADMIN)
    api.force_authenticate(admin)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 403
    assert Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_a_member_cannot_delete_the_organisation(api, org):
    member = _member(org, "member@acme.com", OrgMembership.Role.MEMBER)
    api.force_authenticate(member)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 403


@pytest.mark.django_db
def test_a_stranger_cannot_delete_the_organisation(api, db, org):
    stranger = User.objects.create_user(username="x@y.com", email="x@y.com", password="x")
    api.force_authenticate(stranger)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 403


@pytest.mark.django_db
def test_an_organisation_with_no_plan_can_still_be_deleted(api, owner, org):
    """The one most likely to want to: the free year ended and it did not pay.
    Every other write answers 402 at this point (orgs/permissions.py)."""
    Subscription.objects.filter(org=org).delete()
    api.force_authenticate(owner)

    blocked = api.patch(f"/api/orgs/{org.slug}/", {"one_liner": "Still here"}, format="json")
    assert blocked.status_code == 402

    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 204


@pytest.mark.django_db
def test_the_stripe_subscription_is_cancelled_before_the_organisation_goes(api, owner, org, gateway):
    Subscription.objects.filter(org=org).update(
        provider_ref="sub_live_1", status=Subscription.Status.ACTIVE
    )
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 204
    assert gateway.cancelled == ["sub_live_1"]


@pytest.mark.django_db
def test_a_free_period_has_nothing_to_cancel(api, owner, org, gateway):
    """A local free year (EARLYADOPTER, launch) never reached Stripe."""
    Subscription.objects.filter(org=org).update(
        provider_ref="", status=Subscription.Status.TRIALING, trial_end=timezone.now()
    )
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 204
    assert gateway.cancelled == []


@pytest.mark.django_db
def test_nothing_is_deleted_when_stripe_does_not_confirm(api, owner, org, monkeypatch):
    """Better a delete the owner retries than a deleted company still paying."""
    monkeypatch.setattr("billing.subscriptions.get_gateway", lambda: RecordingGateway(fail=True))
    Subscription.objects.filter(org=org).update(
        provider_ref="sub_live_1", status=Subscription.Status.ACTIVE
    )
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 503
    assert Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_the_invoicing_record_outlives_the_organisation(api, owner, org):
    """A fatura has to be kept whether or not the company still has an account
    here — the row keeps the name and tax id it was issued to."""
    invoice = PaidInvoice.objects.create(
        org=org,
        stripe_invoice_id="in_1",
        number="A-1",
        amount_paid_cents=9900,
        customer_name="Acme Freight, Lda.",
        customer_tax_ids="pt_nif 500000000",
        paid_at=timezone.now(),
    )
    api.force_authenticate(owner)
    res = api.delete(f"/api/orgs/{org.slug}/", {"confirm": "Acme Freight"}, format="json")
    assert res.status_code == 204

    invoice.refresh_from_db()
    assert invoice.org_id is None
    assert invoice.customer_name == "Acme Freight, Lda."
    assert invoice.amount_paid_cents == 9900


@pytest.mark.django_db
def test_deleting_the_account_cancels_the_organisations_it_takes_with_it(api, owner, org, gateway):
    """accounts.MeView.delete deletes orgs this person alone owns — through
    the same path, so they cannot keep charging either."""
    Subscription.objects.filter(org=org).update(
        provider_ref="sub_live_1", status=Subscription.Status.ACTIVE
    )
    api.force_authenticate(owner)
    res = api.delete("/api/auth/me/")
    assert res.status_code == 204
    assert gateway.cancelled == ["sub_live_1"]
    assert not Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_an_organisation_with_another_owner_survives_the_account(api, owner, org, gateway):
    _member(org, "second@acme.com", OrgMembership.Role.OWNER)
    Subscription.objects.filter(org=org).update(
        provider_ref="sub_live_1", status=Subscription.Status.ACTIVE
    )
    api.force_authenticate(owner)
    res = api.delete("/api/auth/me/")
    assert res.status_code == 204
    assert Organization.objects.filter(pk=org.pk).exists()
    assert gateway.cancelled == []
