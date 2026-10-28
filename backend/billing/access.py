"""Does this organisation have a plan right now — the one question every
gate asks (publish, post, publish a job, be listed in Discover).

Access is computed live from Subscription rows, never stored: a free year
ends at `trial_end` whether or not the nightly job has run yet.

Grants access:
  - a paid plan or a comp that is `active`;
  - `past_due` — Stripe is still retrying the card; the owners are warned,
    nothing is switched off while the retries run;
  - `trialing` until `trial_end` — the free year, or the rest of it after the
    owners added a card.
Everything else (no row at all, paused, canceled, unpaid, incomplete) does not.
"""

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import Subscription
from .plans import ACCESS_PLANS, choice_for_plan

REMINDER_WINDOW_DAYS = 30


def access_q(now=None) -> Q:
    now = now or timezone.now()
    return Q(plan__in=ACCESS_PLANS) & (
        Q(status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE])
        | Q(status=Subscription.Status.TRIALING, trial_end__gt=now)
    )


def with_billing_access(org_queryset):
    """Organization queryset → only organisations with a plan right now."""
    return org_queryset.filter(
        Exists(Subscription.objects.filter(access_q(), org_id=OuterRef("pk")))
    )


def current_subscription(org):
    """The row that grants access, or — when none does — the latest one."""
    rows = Subscription.objects.filter(org=org, plan__in=ACCESS_PLANS)
    return rows.filter(access_q()).order_by("-created_at", "-id").first() or rows.order_by(
        "-created_at", "-id"
    ).first()


def has_access(org) -> bool:
    return Subscription.objects.filter(access_q(), org=org).exists()


def org_billing_state(org) -> dict:
    """Everything the workspace needs to say about the plan, in one place.

    state:
      free_year   — no card yet, free until `until`
      trialing    — a card is on file, first charge on `until`
      active      — paid, renews (or ends, if `cancel_at_period_end`) on `until`
      past_due    — the last charge failed and Stripe is retrying
      comp        — complimentary, no end
      needs_plan  — never had a plan (an abandoned checkout)
      lapsed      — had one, it ended
    """
    now = timezone.now()
    sub = current_subscription(org)
    managed = bool(sub and sub.provider_ref)
    state = {
        "state": "needs_plan",
        "has_access": False,
        "plan": None,
        "until": None,
        "days_left": None,
        "managed_by_stripe": managed,
        "cancel_at_period_end": bool(sub and sub.cancel_at_period_end),
        "promo_code": sub.promo_code.code if sub and sub.promo_code_id else None,
        "ending_soon": False,
    }
    if sub is None:
        return state

    state["plan"] = choice_for_plan(sub.plan) if sub.plan != Subscription.Plan.COMP else "comp"
    granted = Subscription.objects.filter(access_q(now), pk=sub.pk).exists()
    state["has_access"] = granted

    if sub.plan == Subscription.Plan.COMP and granted:
        state["state"] = "comp"
        return state

    until = sub.trial_end if sub.status == Subscription.Status.TRIALING else sub.current_period_end
    if until:
        state["until"] = until.isoformat()
        state["days_left"] = max(0, (until - now).days)

    if not granted:
        state["state"] = "lapsed"
    elif sub.status == Subscription.Status.PAST_DUE:
        state["state"] = "past_due"
    elif sub.status == Subscription.Status.TRIALING:
        state["state"] = "trialing" if managed else "free_year"
        state["ending_soon"] = not managed and until is not None and (until - now).days < REMINDER_WINDOW_DAYS
    else:
        state["state"] = "active"
    return state


class PlanRequired(APIException):
    status_code = 402
    default_code = "plan_required"
    default_detail = "This organisation needs an active plan."


def require_access(org) -> None:
    if not has_access(org):
        raise PlanRequired(
            {
                "detail": "This organisation needs an active plan. Owners and admins can choose one under Plan in the workspace.",
                "code": "plan_required",
            }
        )
