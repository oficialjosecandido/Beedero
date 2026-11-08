"""What an organisation can buy. Prices include VAT (IVA incluído).

The price depends on what the organisation is (orgs/kinds.py):

  startup — €33/year or €3/month
  company — €99/year or €9/month

The amounts here are for display only — Stripe charges whatever its Price
says. The Price ids come from the environment (STRIPE_PRICE_YEARLY and
STRIPE_PRICE_MONTHLY for companies, STRIPE_PRICE_STARTUP_YEARLY and
STRIPE_PRICE_STARTUP_MONTHLY for startups), so changing a price is done in
Stripe, then here.
"""

from django.conf import settings

from .models import Subscription

# Bump when the subscription terms change; every acceptance records it.
TERMS_VERSION = "2026-11-06"

STARTUP = "startup"
COMPANY = "company"
KINDS = (STARTUP, COMPANY)
CHOICES = ("yearly", "monthly")

PLANS = {
    (COMPANY, "yearly"): {
        "plan": Subscription.Plan.ORG_YEARLY,
        "amount_cents": 9900,
        "interval": "year",
        "price_setting": "STRIPE_PRICE_YEARLY",
    },
    (COMPANY, "monthly"): {
        "plan": Subscription.Plan.ORG_MONTHLY,
        "amount_cents": 900,
        "interval": "month",
        "price_setting": "STRIPE_PRICE_MONTHLY",
    },
    (STARTUP, "yearly"): {
        "plan": Subscription.Plan.STARTUP_YEARLY,
        "amount_cents": 3300,
        "interval": "year",
        "price_setting": "STRIPE_PRICE_STARTUP_YEARLY",
    },
    (STARTUP, "monthly"): {
        "plan": Subscription.Plan.STARTUP_MONTHLY,
        "amount_cents": 300,
        "interval": "month",
        "price_setting": "STRIPE_PRICE_STARTUP_MONTHLY",
    },
}

# Plan value → (kind, choice), the other way round.
BY_PLAN = {spec["plan"]: key for key, spec in PLANS.items()}

PAID_PLANS = tuple(BY_PLAN)

ACCESS_PLANS = (*PAID_PLANS, Subscription.Plan.COMP)


def spec(kind: str, choice: str) -> dict:
    return PLANS[(kind, choice)]


def plan_for(kind: str, choice: str) -> str:
    return PLANS[(kind, choice)]["plan"]


def price_id(kind: str, choice: str) -> str:
    """The Stripe Price id for a plan. Unset (development, tests) it falls back
    to a placeholder the real gateway refuses — see billing/gateway.py."""
    setting = PLANS[(kind, choice)]["price_setting"]
    return getattr(settings, setting, "") or f"price_stub_{kind}_{choice}"


def plan_for_price(price: str) -> str | None:
    for kind, choice in PLANS:
        if price and price == price_id(kind, choice):
            return PLANS[(kind, choice)]["plan"]
    return None


def choice_for_plan(plan: str) -> str:
    return BY_PLAN.get(plan, (COMPANY, "yearly"))[1]


def kind_for_plan(plan: str) -> str | None:
    """None for plans that belong to no kind (complimentary, legacy)."""
    found = BY_PLAN.get(plan)
    return found[0] if found else None


def amount_for_plan(plan: str) -> int:
    found = BY_PLAN.get(plan)
    return PLANS[found]["amount_cents"] if found else 0


def monthly_cents(plan: str) -> float:
    found = BY_PLAN.get(plan)
    if not found:
        return 0
    item = PLANS[found]
    return (
        item["amount_cents"] / 12
        if item["interval"] == "year"
        else item["amount_cents"]
    )


def public_prices(kind: str = COMPANY) -> list[dict]:
    return [
        {
            "kind": kind,
            "choice": choice,
            "amount_cents": PLANS[(kind, choice)]["amount_cents"],
            "interval": PLANS[(kind, choice)]["interval"],
            "vat_included": True,
        }
        for choice in CHOICES
    ]


def price_text(kind: str) -> str:
    """For emails and notifications: €99/year or €9/month."""
    yearly, monthly = (PLANS[(kind, choice)]["amount_cents"] for choice in CHOICES)
    return f"€{yearly // 100}/year or €{monthly // 100}/month"
