import pytest
from django.db import IntegrityError

from billing.entitlements import PAID_FEATURES_LIVE, has_entitlement
from billing.models import CommitmentFee, OrgCredit, Subscription
from billing.services import (
    confirm_payment,
    get_or_create_stripe_customer,
    maybe_refund_as_credit,
    start_commitment_fee,
)
from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import OrgField, OrgMembership, Organization


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.DRAFT)


def _complete_org(org):
    """Fills every REFUND_REQUIREMENTS section so is_refund_eligible(org) is True."""
    org.logo = "org_logos/acme.png"
    org.save(update_fields=["logo"])
    for kind in (SectionKind.ABOUT, SectionKind.PRODUCTS, SectionKind.MARKET_THESIS):
        section = org.sections.get(kind=kind)
        OrgField.objects.create(section=section, key="k", value="v")
    user = User.objects.create_user(username="owner", email="owner@acme.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)


@pytest.mark.django_db
def test_start_commitment_fee_is_idempotent(org):
    fee1 = start_commitment_fee(org)
    fee2 = start_commitment_fee(org)
    assert fee1.pk == fee2.pk
    assert CommitmentFee.objects.filter(org=org).count() == 1


@pytest.mark.django_db
def test_confirm_payment_marks_paid_and_activates_org(org):
    fee = start_commitment_fee(org)
    confirm_payment(fee, provider_ref="dev-stub")
    fee.refresh_from_db()
    org.refresh_from_db()
    assert fee.status == CommitmentFee.Status.PAID
    assert fee.paid_at is not None
    assert fee.provider_ref == "dev-stub"
    assert org.status == Organization.Status.LIVE


@pytest.mark.django_db
def test_confirm_payment_is_a_noop_once_already_paid(org):
    fee = start_commitment_fee(org)
    confirm_payment(fee, provider_ref="first")
    paid_at = CommitmentFee.objects.get(pk=fee.pk).paid_at

    fee.refresh_from_db()
    confirm_payment(fee, provider_ref="second")
    fee.refresh_from_db()
    assert fee.provider_ref == "first"
    assert fee.paid_at == paid_at


@pytest.mark.django_db
def test_maybe_refund_as_credit_noop_without_a_paid_fee(org):
    _complete_org(org)
    maybe_refund_as_credit(org)
    assert OrgCredit.objects.filter(org=org).count() == 0


@pytest.mark.django_db
def test_maybe_refund_as_credit_noop_when_profile_incomplete(org):
    fee = start_commitment_fee(org)
    confirm_payment(fee)
    maybe_refund_as_credit(org)
    fee.refresh_from_db()
    assert fee.status == CommitmentFee.Status.PAID
    assert OrgCredit.objects.filter(org=org).count() == 0


@pytest.mark.django_db
def test_maybe_refund_as_credit_issues_credit_once_eligible(org):
    fee = start_commitment_fee(org)
    confirm_payment(fee)
    _complete_org(org)

    maybe_refund_as_credit(org)
    fee.refresh_from_db()
    assert fee.status == CommitmentFee.Status.REFUNDED
    assert fee.refunded_at is not None
    credits = list(OrgCredit.objects.filter(org=org))
    assert len(credits) == 1
    assert credits[0].amount_cents == fee.amount_cents
    assert credits[0].reason == "commitment_fee_refund"

    # Calling again (e.g. another field save) must not double-issue credit.
    maybe_refund_as_credit(org)
    assert OrgCredit.objects.filter(org=org).count() == 1


@pytest.mark.django_db
def test_get_or_create_stripe_customer_is_idempotent(org, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    customer1 = get_or_create_stripe_customer(org)
    customer2 = get_or_create_stripe_customer(org)
    assert customer1.pk == customer2.pk
    assert customer1.provider_ref == f"stub_cus_{org.slug}"


@pytest.mark.django_db
def test_subscription_requires_an_org_or_a_user():
    with pytest.raises(IntegrityError):
        Subscription.objects.create(org=None, user=None)


@pytest.mark.django_db
def test_has_entitlement_is_open_when_feature_not_gated(org):
    assert "profile_viewers" not in PAID_FEATURES_LIVE
    assert has_entitlement(org, "profile_viewers") is True


@pytest.mark.django_db
def test_has_entitlement_gates_by_plan_once_a_feature_goes_live(org, monkeypatch):
    monkeypatch.setattr("billing.entitlements.PAID_FEATURES_LIVE", {"deck_analytics"})
    assert has_entitlement(org, "deck_analytics") is False

    Subscription.objects.create(org=org, plan=Subscription.Plan.FOUNDER_PRO, status=Subscription.Status.ACTIVE)
    assert has_entitlement(org, "deck_analytics") is True


@pytest.mark.django_db
def test_has_entitlement_ignores_canceled_subscriptions(org, monkeypatch):
    monkeypatch.setattr("billing.entitlements.PAID_FEATURES_LIVE", {"deck_analytics"})
    Subscription.objects.create(org=org, plan=Subscription.Plan.FOUNDER_PRO, status=Subscription.Status.CANCELED)
    assert has_entitlement(org, "deck_analytics") is False
