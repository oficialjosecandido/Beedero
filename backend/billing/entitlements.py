"""The monetization switch (freemium doc §1/§8).

Endpoints call `has_entitlement(subject, feature)` from day one. Whether that
call actually restricts anything is controlled by `PAID_FEATURES_LIVE` alone:
empty set -> everything free for everyone. Turning on revenue for a feature
is adding its name to that set, not touching any endpoint.
"""

from django.db import models


class Plan(models.TextChoices):
    FREE = "free"
    FOUNDER_PRO = "founder_pro"  # dormant for now
    # investor_pro will come much later


ENTITLEMENTS = {
    Plan.FREE: {
        "create_profile",
        "publish",
        "follow",
        "post",
        "contact_basic",
        "discovery_basic",
        "insight_teaser",
    },
    Plan.FOUNDER_PRO: {
        # everything in free, plus:
        "create_profile",
        "publish",
        "follow",
        "post",
        "contact_basic",
        "discovery_basic",
        "insight_teaser",
        "profile_viewers",
        "deck_analytics",
        "interest_signals",
        "discovery_advanced",
    },
}

# Paid features currently enforced. Empty -> nothing is gated yet.
PAID_FEATURES_LIVE: set[str] = set()


def _current_plan(subject) -> str:
    subscription = _active_subscription(subject)
    return subscription.plan if subscription else Plan.FREE


def _active_subscription(subject):
    from .models import Subscription

    if subject is None:
        return None
    from orgs.models import Organization

    lookup = {"org": subject} if isinstance(subject, Organization) else {"user": subject}
    return Subscription.objects.filter(status="active", **lookup).order_by("-id").first()


def has_entitlement(subject, feature: str) -> bool:
    if feature not in PAID_FEATURES_LIVE:
        return True
    plan = _current_plan(subject)
    return feature in ENTITLEMENTS.get(plan, ENTITLEMENTS[Plan.FREE])
