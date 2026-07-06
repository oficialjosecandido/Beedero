"""State machine for the (now inactive) commitment fee, plus Stripe
scaffolding for the freemium model (doc §3/§6/§7/§10).

`confirm_payment` is the one function a real payment provider integration
will call from a webhook handler later. It's no longer wired into org
activation (publishing is free — see `orgs.views.OrgActivateView`), but is
kept callable/tested so a future paid "featured" tier can reuse the same
fee -> credit machinery without rebuilding it.
"""

import os

from django.utils import timezone

from orgs.completeness import is_refund_eligible
from orgs.models import Organization

from .models import CommitmentFee, OrgCredit, StripeCustomer

DEFAULT_FEE_CENTS = 4000


def get_or_create_stripe_customer(org):
    """Lazy customer creation (doc §6): called on org creation or first
    upgrade attempt, so nothing needs backfilling on launch day. No real
    Stripe call is made yet — STRIPE_SECRET_KEY is unset in every
    environment — so this stores a stub ref. Swap the body for a real
    `stripe.Customer.create(...)` call once a key is configured; callers
    don't need to change.
    """
    customer = getattr(org, "stripe_customer", None)
    if customer:
        return customer
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    provider_ref = f"stub_cus_{org.slug}" if not stripe_key else _create_real_stripe_customer(org, stripe_key)
    return StripeCustomer.objects.create(org=org, provider_ref=provider_ref)


def _create_real_stripe_customer(org, stripe_key):  # pragma: no cover - no key configured anywhere yet
    import stripe

    stripe.api_key = stripe_key
    customer = stripe.Customer.create(name=org.name, metadata={"org_slug": org.slug})
    return customer["id"]


def start_commitment_fee(org, amount_cents=DEFAULT_FEE_CENTS):
    fee, _ = CommitmentFee.objects.get_or_create(org=org, defaults={"amount_cents": amount_cents})
    return fee


def confirm_payment(fee, provider_ref=""):
    if fee.status != CommitmentFee.Status.PENDING:
        return fee
    fee.status = CommitmentFee.Status.PAID
    fee.paid_at = timezone.now()
    fee.provider_ref = provider_ref
    fee.save()
    fee.org.status = Organization.Status.LIVE
    fee.org.save(update_fields=["status"])
    return fee


def maybe_refund_as_credit(org):
    fee = getattr(org, "commitment_fee", None)
    if not fee or fee.status != CommitmentFee.Status.PAID:
        return
    if not is_refund_eligible(org):
        return
    OrgCredit.objects.create(org=org, amount_cents=fee.amount_cents, reason="commitment_fee_refund")
    fee.status = CommitmentFee.Status.REFUNDED
    fee.refunded_at = timezone.now()
    fee.save()
