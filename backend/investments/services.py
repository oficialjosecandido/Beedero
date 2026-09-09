"""Business logic for InvestmentRecord — mirrors affiliations/services.py's
plain-function, @transaction.atomic-on-writes convention, and the same
declare -> counterparty confirm/dispute shape.

Doc `beedero-registo-investimento-bilateral.md` §0/§7: this is a passive
registry, never intermediation — no instrument, no signature, no money
handling. Copy must never describe Beedero as facilitating the investment.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from notifications.models import Notification
from notifications.services import notify
from orgs.models import Organization, OrgMembership

from .models import InvestmentRecord

User = get_user_model()

DAILY_LIMIT_PER_ORG = 20


def _is_org_member(user, org) -> bool:
    return OrgMembership.objects.filter(org=org, user=user).exists()


def _check_daily_limit(org) -> None:
    since = timezone.now() - timedelta(days=1)
    count = InvestmentRecord.objects.filter(org=org, created_at__gte=since).count()
    if count >= DAILY_LIMIT_PER_ORG:
        raise ValidationError({"org": "Daily investment registration limit reached for this organization."})


def _notify_counterparty_of_request(record: InvestmentRecord, recipient) -> None:
    notify(
        recipient,
        kind=Notification.Kind.INVESTMENT_REQUEST,
        aggregate_key=f"investment_request:{record.id}",
        title="Investment record awaiting confirmation",
        body=f"A €{record.amount_cents / 100:,.2f} investment on {record.invested_on} was registered and needs your confirmation.",
        link=f"/dashboard/{record.org.slug}" if record.declarer_side == "investor" else "/dashboard",
        payload={"investment_id": record.id, "can_confirm": True},
    )


@transaction.atomic
def declare_investment_as_investor(
    user,
    org: Organization,
    *,
    amount_cents: int,
    currency: str = "EUR",
    invested_on: date,
    instrument: str = "",
    round=None,
    investor_public_intent: bool = False,
    amount_public_intent: bool = False,
) -> InvestmentRecord:
    if org.status != Organization.Status.LIVE:
        raise ValidationError({"org": "Only live organizations can be recorded."})
    _check_daily_limit(org)

    record = InvestmentRecord.objects.create(
        org=org,
        round=round,
        investor_user=user,
        amount_cents=amount_cents,
        currency=currency,
        invested_on=invested_on,
        instrument=instrument,
        declared_by=user,
        declarer_side="investor",
        investor_public=investor_public_intent,
        declarer_amount_public_intent=amount_public_intent,
    )
    for admin in User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct():
        _notify_counterparty_of_request(record, admin)
    return record


@transaction.atomic
def declare_investment_as_startup(
    declaring_user,
    org: Organization,
    *,
    investor_user=None,
    investor_external_name: str = "",
    amount_cents: int,
    currency: str = "EUR",
    invested_on: date,
    instrument: str = "",
    round=None,
    amount_public_intent: bool = False,
) -> InvestmentRecord:
    if org.status != Organization.Status.LIVE:
        raise ValidationError({"org": "Only live organizations can be recorded."})
    if bool(investor_user) == bool(investor_external_name):
        raise ValidationError({"investor": "Provide exactly one of investor_user or investor_external_name."})
    _check_daily_limit(org)

    record = InvestmentRecord.objects.create(
        org=org,
        round=round,
        investor_user=investor_user,
        investor_external_name=investor_external_name,
        amount_cents=amount_cents,
        currency=currency,
        invested_on=invested_on,
        instrument=instrument,
        declared_by=declaring_user,
        declarer_side="startup",
        declarer_amount_public_intent=amount_public_intent,
    )
    if investor_user is not None:
        _notify_counterparty_of_request(record, investor_user)
    return record


def _authorize_counterparty(record: InvestmentRecord, by) -> None:
    if record.declarer_side == "investor":
        if not _is_org_member(by, record.org):
            raise PermissionDenied("Only a member of this organization can act on this record.")
    else:
        if record.investor_user_id is None or record.investor_user_id != by.id:
            raise PermissionDenied("Only the investor on this record can act on it.")


@transaction.atomic
def confirm_investment(
    record: InvestmentRecord,
    by,
    *,
    investor_public_intent: bool | None = None,
    amount_public_intent: bool = False,
) -> InvestmentRecord:
    if record.investor_user_id is None:
        raise ValidationError({"investor": "A record for an external investor cannot be confirmed."})
    _authorize_counterparty(record, by)
    if record.status != InvestmentRecord.Status.DECLARED:
        raise ValidationError({"status": "Only a declared record can be confirmed."})

    record.confirmer_amount_public_intent = amount_public_intent
    record.amount_public = record.declarer_amount_public_intent and record.confirmer_amount_public_intent
    # investor_public can only ever be set by the investor's own intent —
    # whichever side of the exchange they were on.
    if by.id == record.investor_user_id and investor_public_intent is not None:
        record.investor_public = investor_public_intent
    record.status = InvestmentRecord.Status.CONFIRMED
    record.confirmed_by = by
    record.confirmed_at = timezone.now()
    record.save()

    amount_label = f"€{record.amount_cents / 100:,.2f}" if record.amount_public else "an investment"
    body = f"{record.org.name} and the investor both confirmed {amount_label} on {record.invested_on}."
    payload = {
        "suggestion_title": f"A new investment in {record.org.name} was just confirmed on Beedero!",
        "suggestion_body": f"{record.org.name} confirmed receiving {amount_label} on {record.invested_on}.",
    }
    recipients = {record.declared_by_id, record.investor_user_id}
    recipients.discard(None)
    for recipient in User.objects.filter(id__in=recipients):
        notify(
            recipient,
            kind=Notification.Kind.INVESTMENT_UPDATE,
            aggregate_key=f"investment_update:{record.id}",
            title="Investment confirmed",
            body=body,
            link=f"/dashboard/{record.org.slug}",
            payload=payload,
        )
    return record


@transaction.atomic
def dispute_investment(record: InvestmentRecord, by) -> InvestmentRecord:
    _authorize_counterparty(record, by)
    if record.status != InvestmentRecord.Status.DECLARED:
        raise ValidationError({"status": "Only a declared record can be disputed."})

    record.status = InvestmentRecord.Status.DISPUTED
    record.save(update_fields=["status"])
    if record.declared_by_id:
        notify(
            record.declared_by,
            kind=Notification.Kind.INVESTMENT_UPDATE,
            aggregate_key=f"investment_update:{record.id}",
            title="Investment record disputed",
            body=f"{record.org.name} disputed the investment record you registered." if record.declarer_side == "investor"
            else "The investor disputed the investment record registered on their behalf.",
            link="/dashboard",
        )
    return record


def round_progress(org: Organization, round) -> dict:
    confirmed = InvestmentRecord.objects.filter(org=org, round=round, status=InvestmentRecord.Status.CONFIRMED)
    declared = InvestmentRecord.objects.filter(org=org, round=round, status=InvestmentRecord.Status.DECLARED)
    confirmed_sum = confirmed.aggregate(total=Sum("amount_cents"))["total"] or 0
    declared_sum = declared.aggregate(total=Sum("amount_cents"))["total"] or 0
    backed = backed_investors_summary(org)
    return {
        "confirmed_amount_cents": confirmed_sum,
        "declared_amount_cents": declared_sum,
        "confirmed_count": confirmed.count(),
        "declared_count": declared.count(),
        **backed,
    }


def backed_investors_summary(org: Organization) -> dict:
    confirmed = InvestmentRecord.objects.filter(
        org=org, status=InvestmentRecord.Status.CONFIRMED, investor_user__isnull=False
    ).select_related("investor_user__investorprofile")
    seen_ids: set[int] = set()
    names: list[str] = []
    for record in confirmed:
        if record.investor_user_id in seen_ids:
            continue
        seen_ids.add(record.investor_user_id)
        if record.investor_public:
            profile = getattr(record.investor_user, "investorprofile", None)
            names.append(profile.full_name if profile and profile.full_name else record.investor_user.email.split("@", 1)[0])
    return {"backed_investors_count": len(seen_ids), "backed_investors": names}


def investor_portfolio(handle: str) -> list[dict]:
    from accounts.models import InvestorProfile

    profile = InvestorProfile.objects.filter(handle=handle).select_related("user").first()
    if profile is None:
        return []
    records = (
        InvestmentRecord.objects.filter(
            investor_user=profile.user, status=InvestmentRecord.Status.CONFIRMED, investor_public=True
        )
        .select_related("org")
        .order_by("-invested_on")
    )
    return [
        {
            "org": {"slug": r.org.slug, "name": r.org.name, "one_liner": r.org.one_liner, "logo": r.org.logo.url if r.org.logo else None},
            "invested_on": r.invested_on.isoformat(),
            "amount_cents": r.amount_cents if r.amount_public else None,
            "currency": r.currency,
            "instrument": r.instrument,
        }
        for r in records
    ]
