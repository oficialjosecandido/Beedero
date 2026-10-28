"""What an organisation can buy. Prices include VAT (IVA incluído).

The amounts here are for display only — Stripe charges whatever its Price
says. The Price ids come from the environment (STRIPE_PRICE_YEARLY /
STRIPE_PRICE_MONTHLY), so changing a price is done in Stripe, then here.
"""

from django.conf import settings

from .models import Subscription

# Bump when the subscription terms change; every acceptance records it.
TERMS_VERSION = "2026-11-01"

PLANS = {
    "yearly": {
        "plan": Subscription.Plan.ORG_YEARLY,
        "amount_cents": 9900,
        "interval": "year",
        "price_setting": "STRIPE_PRICE_YEARLY",
    },
    "monthly": {
        "plan": Subscription.Plan.ORG_MONTHLY,
        "amount_cents": 900,
        "interval": "month",
        "price_setting": "STRIPE_PRICE_MONTHLY",
    },
}

ACCESS_PLANS = (
    Subscription.Plan.ORG_YEARLY,
    Subscription.Plan.ORG_MONTHLY,
    Subscription.Plan.COMP,
)


def price_id(choice: str) -> str:
    """The Stripe Price id for a plan. Unset (development, tests) it falls back
    to a placeholder the real gateway refuses — see billing/gateway.py."""
    return getattr(settings, PLANS[choice]["price_setting"], "") or f"price_stub_{choice}"


def plan_for_price(price: str) -> str | None:
    for choice in PLANS:
        if price and price == price_id(choice):
            return PLANS[choice]["plan"]
    return None


def choice_for_plan(plan: str) -> str:
    return "monthly" if plan == Subscription.Plan.ORG_MONTHLY else "yearly"


def public_prices() -> list[dict]:
    return [
        {"choice": choice, "amount_cents": spec["amount_cents"], "interval": spec["interval"], "vat_included": True}
        for choice, spec in PLANS.items()
    ]
