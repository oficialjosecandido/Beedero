"""Revenue and the billing chores, for admins.

MRR counts what is being paid now: Stripe subscriptions that are `active`
or `past_due` (still being retried). A card added during the free year
(`trialing`) is not revenue yet. Amounts include VAT, as the prices do; the
net figure takes the Portuguese 23% out.
"""

from datetime import timedelta

from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.access import access_q, org_billing_state
from billing.models import PaidInvoice, PromoCode, Subscription
from billing.plans import PLANS, choice_for_plan
from orgs.models import Organization

from . import audit
from .access import IsNexusAdmin
from .common import iso
from .models import NexusAction

VAT = 0.23
PAYING = (Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE)
FREE_SOURCES = (Subscription.Source.PROMO, Subscription.Source.LAUNCH, Subscription.Source.ADMIN)


def _monthly_cents(plan: str) -> float:
    spec = PLANS[choice_for_plan(plan)]
    return spec["amount_cents"] / 12 if spec["interval"] == "year" else spec["amount_cents"]


def stripe_rows():
    return Subscription.objects.exclude(provider_ref="").filter(
        plan__in=[Subscription.Plan.ORG_YEARLY, Subscription.Plan.ORG_MONTHLY]
    )


def revenue_summary(now=None) -> dict:
    now = now or timezone.now()
    paying = list(stripe_rows().filter(status__in=PAYING).values_list("org_id", "plan"))
    mrr = sum(_monthly_cents(plan) for _, plan in paying)
    yearly = sum(1 for _, plan in paying if plan == Subscription.Plan.ORG_YEARLY)
    free_now = Subscription.objects.filter(
        provider_ref="", status=Subscription.Status.TRIALING, trial_end__gt=now, source__in=FREE_SOURCES
    )
    ended = Subscription.objects.filter(
        provider_ref="", source__in=FREE_SOURCES, trial_end__lte=now, trial_end__gte=now - timedelta(days=365)
    )
    converted = ended.filter(
        Exists(
            stripe_rows()
            .filter(org_id=OuterRef("org_id"))
            .exclude(status__in=[Subscription.Status.INCOMPLETE, Subscription.Status.INCOMPLETE_EXPIRED])
        )
    )
    ended_n, converted_n = ended.count(), converted.count()
    return {
        "paying_orgs": len({org_id for org_id, _ in paying}),
        "paying_yearly": yearly,
        "paying_monthly": len(paying) - yearly,
        "mrr_cents": round(mrr),
        "mrr_net_cents": round(mrr / (1 + VAT)),
        "arr_cents": round(mrr * 12),
        "card_on_file_in_free_year": stripe_rows().filter(status=Subscription.Status.TRIALING).count(),
        "free_periods_active": free_now.count(),
        "free_periods_ending_30d": free_now.filter(trial_end__lte=now + timedelta(days=30)).count(),
        "past_due": stripe_rows().filter(status=Subscription.Status.PAST_DUE).count(),
        "free_periods_ended_12m": ended_n,
        "free_periods_converted_12m": converted_n,
        "conversion_pct": round(100 * converted_n / ended_n) if ended_n else None,
        "orgs_without_plan": Organization.objects.exclude(
            Exists(Subscription.objects.filter(access_q(now), org_id=OuterRef("pk")))
        ).count(),
    }


def _org_row(org, extra: dict | None = None) -> dict:
    return {"slug": org.slug, "name": org.name, **org_billing_state(org), **(extra or {})}


def _invoice(row: PaidInvoice) -> dict:
    return {
        "id": row.id,
        "org": {"slug": row.org.slug, "name": row.org.name} if row.org_id else None,
        "number": row.number,
        "amount_cents": row.amount_paid_cents,
        "currency": row.currency,
        "customer_name": row.customer_name,
        "customer_tax_ids": row.customer_tax_ids,
        "receipt_url": row.hosted_invoice_url,
        "paid_at": iso(row.paid_at),
        "fatura_reference": row.fatura_reference,
        "fatura_issued_at": iso(row.fatura_issued_at),
    }


def _promo(code: PromoCode) -> dict:
    return {
        "code": code.code,
        "free_days": code.free_days,
        "active": code.active,
        "redemptions": getattr(code, "redemptions", None),
        "max_redemptions": code.max_redemptions,
        "expires_at": iso(code.expires_at),
        "note": code.note,
        "created_at": iso(code.created_at),
    }


class BillingView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request):
        now = timezone.now()
        ending = (
            Subscription.objects.filter(
                provider_ref="",
                status=Subscription.Status.TRIALING,
                trial_end__gt=now,
                trial_end__lte=now + timedelta(days=30),
            )
            .select_related("org")
            .order_by("trial_end")[:50]
        )
        past_due = stripe_rows().filter(status=Subscription.Status.PAST_DUE).select_related("org")[:50]
        abandoned = (
            Organization.objects.exclude(Exists(Subscription.objects.filter(org_id=OuterRef("pk"))))
            .filter(created_at__lte=now - timedelta(hours=1))
            .order_by("-created_at")[:50]
        )
        to_issue = PaidInvoice.objects.filter(fatura_reference="").select_related("org").order_by("paid_at")
        issued = PaidInvoice.objects.exclude(fatura_reference="").select_related("org")[:20]
        codes = PromoCode.objects.annotate(redemptions=Count("subscriptions")).order_by("-created_at")
        return Response(
            {
                "summary": revenue_summary(now),
                "free_ending": [_org_row(sub.org) for sub in ending if sub.org_id],
                "past_due": [_org_row(sub.org) for sub in past_due if sub.org_id],
                "without_plan": [_org_row(org, {"created_at": iso(org.created_at)}) for org in abandoned],
                "invoices_to_issue": [_invoice(row) for row in to_issue],
                "invoices_issued": [_invoice(row) for row in issued],
                "promo_codes": [_promo(code) for code in codes],
            }
        )


class InvoiceIssueView(APIView):
    """The fatura was issued in the certified software: record its number."""

    permission_classes = [IsNexusAdmin]

    def post(self, request, pk):
        invoice = PaidInvoice.objects.select_related("org").filter(pk=pk).first()
        if invoice is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        reference = (request.data.get("fatura_reference") or "").strip()[:60]
        if not reference:
            raise ValidationError({"fatura_reference": ["Write the fatura number."]})
        invoice.fatura_reference = reference
        invoice.fatura_issued_at = timezone.now()
        invoice.save(update_fields=["fatura_reference", "fatura_issued_at"])
        audit.record(
            request.user,
            NexusAction.Action.INVOICE_ISSUED,
            target_type="invoice",
            target_id=invoice.id,
            label=invoice.number or invoice.stripe_invoice_id,
            fatura=reference,
        )
        return Response(_invoice(invoice))


class PromoCodesView(APIView):
    permission_classes = [IsNexusAdmin]

    def post(self, request):
        raw = (request.data.get("code") or "").strip().upper()
        if not raw or not raw.replace("-", "").replace("_", "").isalnum() or len(raw) > 40:
            raise ValidationError({"code": ["Letters, numbers, - and _ only, up to 40."]})
        if PromoCode.objects.filter(code=raw).exists():
            raise ValidationError({"code": ["That code already exists."]})
        try:
            free_days = int(request.data.get("free_days") or 365)
            max_redemptions = request.data.get("max_redemptions")
            max_redemptions = int(max_redemptions) if max_redemptions not in (None, "") else None
        except (TypeError, ValueError) as exc:
            raise ValidationError({"detail": "Days and limit must be whole numbers."}) from exc
        if not 1 <= free_days <= 730:
            raise ValidationError({"free_days": ["Between 1 and 730 days."]})
        expires_at = parse_datetime(request.data.get("expires_at") or "") if request.data.get("expires_at") else None
        code = PromoCode.objects.create(
            code=raw,
            free_days=free_days,
            max_redemptions=max_redemptions,
            expires_at=expires_at,
            note=(request.data.get("note") or "")[:200],
        )
        audit.record(
            request.user,
            NexusAction.Action.PROMO_CREATED,
            target_type="promo",
            target_id=code.code,
            label=code.code,
            free_days=free_days,
            max_redemptions=max_redemptions,
        )
        return Response(_promo(code), status=201)


class PromoCodeView(APIView):
    permission_classes = [IsNexusAdmin]

    def patch(self, request, code):
        promo = PromoCode.objects.filter(code=code.upper()).first()
        if promo is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if "active" not in request.data:
            raise ValidationError({"active": ["Say whether the code is active."]})
        promo.active = bool(request.data["active"])
        promo.save(update_fields=["active"])
        audit.record(
            request.user,
            NexusAction.Action.PROMO_CHANGED,
            target_type="promo",
            target_id=promo.code,
            label=promo.code,
            active=promo.active,
        )
        return Response(_promo(promo))
