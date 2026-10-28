"""Organisation subscriptions: free periods, checkout, Stripe sync, reminders.

Two ways in:
  - a code (EARLYADOPTER) → a local free period, no card, nothing in Stripe;
  - no code → Stripe Checkout, paid from day one.

One way to keep paying: Stripe Checkout. Owners on a free period who add a
card before it ends go through the same checkout with `trial_end` set to the
end of their free year, so the first charge lands the day the free year
ends. Stripe's subscription then takes over and the local row is closed.

Every Stripe write to our database goes through `sync_stripe_subscription`,
from the webhook and from the browser coming back from checkout alike, so
the two can arrive in any order.
"""

import logging
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import sentry_sdk
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from beedero.email_brand import frontend_url, wrap_email
from orgs.models import Organization, OrgMembership

from .access import current_subscription, has_access
from .gateway import BillingUnavailable, get_gateway
from .models import PaidInvoice, PromoCode, StripeCustomer, StripeEvent, Subscription
from .plans import PLANS, plan_for_price

logger = logging.getLogger(__name__)

# Stripe refuses a checkout trial that ends sooner than this.
MIN_CHECKOUT_TRIAL = timedelta(hours=48, minutes=10)
REMINDER_DAYS = (30, 7, 1)
LAUNCH_FREE_DAYS = 365


def _ts(value) -> datetime | None:
    return datetime.fromtimestamp(int(value), tz=dt_timezone.utc) if value else None


def _id(value) -> str:
    """Stripe fields are an id or an expanded object."""
    if isinstance(value, dict):
        return value.get("id", "")
    return value or ""


# ------------------------------------------------------------------ codes


def find_code(raw: str) -> tuple[PromoCode | None, str]:
    """(code, problem). `problem` is empty when the code can be used."""
    code = PromoCode.objects.filter(code=(raw or "").strip().upper()).first()
    if code is None or not code.active:
        return None, "This code doesn't exist."
    if code.expires_at and code.expires_at <= timezone.now():
        return None, "This code has expired."
    if code.max_redemptions is not None and code.subscriptions.count() >= code.max_redemptions:
        return None, "This code has been used up."
    return code, ""


def free_period_used(org) -> bool:
    return Subscription.objects.filter(
        org=org, source__in=[Subscription.Source.PROMO, Subscription.Source.LAUNCH]
    ).exists()


def redeem_free_period(org, choice: str, raw_code: str) -> Subscription:
    """The free year: a local row, trialing until `free_days` from now. The
    plan chosen is what the organisation will pay for afterwards."""
    code, problem = find_code(raw_code)
    if problem:
        raise ValidationError({"code": [problem]})
    if free_period_used(org):
        raise ValidationError({"code": ["This organisation has already had its free year."]})
    try:
        with transaction.atomic():
            return Subscription.objects.create(
                org=org,
                plan=PLANS[choice]["plan"],
                status=Subscription.Status.TRIALING,
                source=Subscription.Source.PROMO,
                promo_code=code,
                trial_end=timezone.now() + timedelta(days=code.free_days),
            )
    except IntegrityError as exc:  # two tabs, same org
        raise ValidationError({"code": ["This organisation has already had its free year."]}) from exc


def grant_launch_year(org, now=None) -> Subscription | None:
    """Every organisation that existed on launch day gets a free year too."""
    now = now or timezone.now()
    if free_period_used(org):
        return None
    return Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.ORG_YEARLY,
        status=Subscription.Status.TRIALING,
        source=Subscription.Source.LAUNCH,
        trial_end=now + timedelta(days=LAUNCH_FREE_DAYS),
    )


def grant_comp(org) -> Subscription:
    """Complimentary, no end — Beedero's own organisation, partners."""
    existing = Subscription.objects.filter(
        org=org, plan=Subscription.Plan.COMP, status=Subscription.Status.ACTIVE
    ).first()
    return existing or Subscription.objects.create(
        org=org, plan=Subscription.Plan.COMP, status=Subscription.Status.ACTIVE, source=Subscription.Source.ADMIN
    )


# --------------------------------------------------------------- checkout


def checkout_trial_end(org):
    """While a free period still has 48h+ to run, a card added now is first
    charged when it ends — never earlier than the free year promised."""
    sub = current_subscription(org)
    if (
        sub
        and not sub.provider_ref
        and sub.status == Subscription.Status.TRIALING
        and sub.trial_end
        and sub.trial_end - timezone.now() >= MIN_CHECKOUT_TRIAL
    ):
        return sub.trial_end
    return None


def start_checkout(org, user, choice: str) -> str:
    managed = Subscription.objects.filter(org=org).exclude(provider_ref="").filter(
        status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING, Subscription.Status.PAST_DUE]
    )
    if managed.exists():
        raise ValidationError({"detail": "This organisation already pays through Stripe — use Manage billing."})
    session = get_gateway().create_checkout_session(org, user, choice, trial_end=checkout_trial_end(org))
    return session["url"]


def portal_url(org) -> str:
    customer = StripeCustomer.objects.filter(org=org).first()
    if customer is None:
        raise ValidationError({"detail": "This organisation has no billing account yet."})
    return get_gateway().create_portal_session(
        customer.provider_ref, frontend_url(f"dashboard/{org.slug}?tab=billing")
    )


class CancelFailed(APIException):
    status_code = 503
    default_code = "cancel_failed"
    default_detail = "Could not cancel the subscription with Stripe."


def release_stripe_subscriptions(org) -> None:
    """Cancels in Stripe everything that would keep charging this organisation.
    Called before it is deleted (orgs/services.py).

    Order matters, and so does failing loudly. The rows go with the
    organisation (`on_delete=CASCADE`), and once it is gone there is no
    workspace left to open the portal from: a subscription left running would
    keep charging a company that no longer exists and nobody could stop it.
    So a Stripe failure here refuses the delete — an owner who tries again in
    a minute is a far better outcome than that.

    Local free periods have nothing in Stripe (`provider_ref` empty), and a
    subscription already canceled needs no second call.
    """
    refs = list(
        Subscription.objects.filter(org=org)
        .exclude(provider_ref="")
        .exclude(
            status__in=[Subscription.Status.CANCELED, Subscription.Status.INCOMPLETE_EXPIRED]
        )
        .values_list("provider_ref", flat=True)
    )
    if not refs:
        return
    try:
        gateway = get_gateway()
        for ref in refs:
            gateway.cancel_subscription(ref)
    except BillingUnavailable as err:
        raise CancelFailed(
            {
                "detail": "This organisation pays through Stripe, which is not configured here, "
                "so the subscription cannot be cancelled. Nothing was deleted.",
                "code": "cancel_failed",
            }
        ) from err
    except Exception as err:
        # Anything Stripe throws: unreachable, rate-limited, a key rotated.
        logger.exception("Could not cancel subscriptions for org %s before deleting it", org.pk)
        sentry_sdk.capture_exception(err)
        raise CancelFailed(
            {
                "detail": "Stripe did not confirm the subscription was cancelled, so nothing was "
                "deleted. Try again in a moment.",
                "code": "cancel_failed",
            }
        ) from err


# ------------------------------------------------------------------- sync


def _org_for(data: dict, fallback=None):
    org_id = (data.get("metadata") or {}).get("org_id") or data.get("client_reference_id")
    if org_id:
        org = Organization.objects.filter(pk=org_id).first()
        if org:
            return org
    customer = _id(data.get("customer"))
    if customer:
        link = StripeCustomer.objects.filter(provider_ref=customer).select_related("org").first()
        if link:
            return link.org
    return fallback


@transaction.atomic
def sync_stripe_subscription(data: dict, org=None) -> Subscription | None:
    """Mirror one Stripe subscription onto its row. Idempotent."""
    ref = _id(data)
    if not ref:
        return None
    existing = Subscription.objects.select_for_update().filter(provider_ref=ref).first()
    org = existing.org if existing else _org_for(data, org)
    if org is None:
        logger.warning("Stripe subscription %s has no organisation", ref)
        return None

    items = (data.get("items") or {}).get("data") or [{}]
    item = items[0]
    plan = plan_for_price(_id(item.get("price"))) or (existing.plan if existing else Subscription.Plan.ORG_YEARLY)
    status = data.get("status")
    if status not in Subscription.Status.values:
        status = existing.status if existing else Subscription.Status.INCOMPLETE

    fields = {
        "org": org,
        "plan": plan,
        "status": status,
        "source": Subscription.Source.CHECKOUT,
        "trial_end": _ts(data.get("trial_end")),
        # Since the 2025 API versions the period lives on the item.
        "current_period_end": _ts(item.get("current_period_end") or data.get("current_period_end")),
        "cancel_at_period_end": bool(data.get("cancel_at_period_end")),
    }
    if existing:
        for name, value in fields.items():
            setattr(existing, name, value)
        existing.save()
        sub = existing
    else:
        sub = Subscription.objects.create(provider_ref=ref, **fields)

    customer = _id(data.get("customer"))
    if customer:
        StripeCustomer.objects.update_or_create(org=org, defaults={"provider_ref": customer})

    # Stripe has taken over: the local free period, if any, is done. Only
    # once the Stripe subscription itself grants access — an incomplete one
    # must not cost the organisation the rest of its free year.
    if status in (Subscription.Status.ACTIVE, Subscription.Status.TRIALING, Subscription.Status.PAST_DUE):
        Subscription.objects.filter(org=org, provider_ref="", status=Subscription.Status.TRIALING).update(
            status=Subscription.Status.CANCELED
        )
    return sub


def sync_checkout_session(session: dict) -> Subscription | None:
    if session.get("mode") != "subscription" or session.get("status") != "complete":
        return None
    subscription = session.get("subscription")
    if not subscription:
        return None
    if not isinstance(subscription, dict):
        subscription = get_gateway().retrieve_subscription(subscription)
    return sync_stripe_subscription(subscription, org=_org_for(session))


def sync_after_return(org, session_id: str) -> Subscription | None:
    """The browser is back from checkout, maybe before the webhook."""
    session = get_gateway().retrieve_checkout_session(session_id)
    found = _org_for(session)
    if found is None or found.pk != org.pk:
        raise ValidationError({"session_id": ["This checkout belongs to another organisation."]})
    return sync_checkout_session(session)


def record_paid_invoice(invoice: dict) -> PaidInvoice | None:
    if not invoice.get("id") or not invoice.get("amount_paid"):
        return None  # €0 invoices (free periods) are not faturas
    org = _org_for(invoice)
    tax_ids = ", ".join(
        f"{tax.get('type', '')} {tax.get('value', '')}".strip() for tax in invoice.get("customer_tax_ids") or []
    )
    paid_at = _ts((invoice.get("status_transitions") or {}).get("paid_at")) or timezone.now()
    row, _ = PaidInvoice.objects.get_or_create(
        stripe_invoice_id=invoice["id"],
        defaults={
            "org": org,
            "number": invoice.get("number") or "",
            "amount_paid_cents": invoice["amount_paid"],
            "currency": invoice.get("currency") or "eur",
            "customer_name": invoice.get("customer_name") or "",
            "customer_tax_ids": tax_ids,
            "hosted_invoice_url": invoice.get("hosted_invoice_url") or "",
            "paid_at": paid_at,
        },
    )
    return row


# ---------------------------------------------------------------- webhook

SUBSCRIPTION_EVENTS = {
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
}


def handle_event(event: dict) -> bool:
    """Apply one webhook event. Returns False when it was already applied."""
    event_id = event.get("id")
    if not event_id:
        return False
    try:
        with transaction.atomic():
            StripeEvent.objects.create(event_id=event_id, type=event.get("type", ""))
    except IntegrityError:
        return False

    kind = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    if kind == "checkout.session.completed":
        sync_checkout_session(obj)
    elif kind in SUBSCRIPTION_EVENTS:
        sync_stripe_subscription(obj)
    elif kind == "invoice.paid":
        record_paid_invoice(obj)
    elif kind == "invoice.payment_failed":
        org = _org_for(obj)
        if org:
            tell_owners(
                org,
                key="payment_failed",
                title=f"Payment failed for {org.name}",
                body="We couldn't charge the card on file. Stripe will try again; update the card "
                "under Plan in the workspace so nothing is switched off.",
            )
    return True


# -------------------------------------------------------------- reminders


def owners(org):
    return [
        m.user
        for m in OrgMembership.objects.filter(
            org=org, role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
        ).select_related("user")
    ]


def tell_owners(org, *, key: str, title: str, body: str) -> None:
    """In-app notification and email to owners and admins, once per `key`."""
    from notifications.models import Notification
    from notifications.services import notify

    link = f"/dashboard/{org.slug}?tab=billing"
    for user in owners(org):
        aggregate_key = f"billing:{org.pk}:{key}"
        if Notification.objects.filter(user=user, aggregate_key=aggregate_key).exists():
            continue
        notify(user, kind=Notification.Kind.BILLING, aggregate_key=aggregate_key, title=title, body=body, link=link)
        html = wrap_email(
            eyebrow="Billing",
            title=title,
            body_html=f"<p style='margin:0;font-size:15px;line-height:1.6'>{body}</p>",
            cta_label="Open billing",
            cta_href=frontend_url(link),
        )
        message = EmailMultiAlternatives(
            f"Beedero — {title}", f"{body}\n\n{frontend_url(link)}\n", settings.DEFAULT_FROM_EMAIL, [user.email]
        )
        message.attach_alternative(html, "text/html")
        try:
            message.send()
        except Exception as exc:  # never let the mail provider stop the job
            sentry_sdk.capture_exception(exc)


def send_free_period_reminders(now=None) -> dict:
    """Daily: warn 30, 7 and 1 day before a free year ends; pause the ones
    that ended. Stripe-managed subscriptions get Stripe's own emails."""
    now = now or timezone.now()
    counts = {"reminded": 0, "paused": 0}
    free = Subscription.objects.filter(
        provider_ref="", status=Subscription.Status.TRIALING, org__isnull=False, trial_end__isnull=False
    ).select_related("org")
    for sub in free:
        org = sub.org
        days = (sub.trial_end - now).days
        if sub.trial_end <= now:
            sub.status = Subscription.Status.PAUSED
            sub.save(update_fields=["status", "updated_at"])
            counts["paused"] += 1
            if not has_access(org):
                tell_owners(
                    org,
                    key=f"free_year_ended:{sub.pk}",
                    title=f"{org.name}'s free year has ended",
                    body="The organisation is paused: it is hidden from Discover and can't post or "
                    "publish jobs. Choose a plan to switch everything back on — nothing was deleted.",
                )
            continue
        # The nearest threshold not yet passed: 30, then 7, then 1 — each once.
        due = next((t for t in sorted(REMINDER_DAYS) if days < t), None)
        if due is None:
            continue
        tell_owners(
            org,
            key=f"free_year_ends:{sub.pk}:{due}",
            title=f"{org.name}'s free year ends on {sub.trial_end:%d %b %Y}",
            body="Add a card now and the first charge only happens that day. Without one, the "
            "organisation pauses when the free year ends.",
        )
        counts["reminded"] += 1
    return counts
