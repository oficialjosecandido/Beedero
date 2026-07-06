"""State machine for the commitment fee (doc §3/§10).

`confirm_payment` is the one function a real payment provider integration
will call from a webhook handler later. For now, `orgs.views.OrgActivateView`
calls it directly as a dev stub — swapping in a real provider only changes
who calls it, not what it does.
"""

from django.utils import timezone

from orgs.completeness import is_refund_eligible
from orgs.models import Organization

from .models import CommitmentFee, OrgCredit

DEFAULT_FEE_CENTS = 4000


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
