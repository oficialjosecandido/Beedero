"""Private vitality checklist for founders (doc §B5) — not a public score."""

from datetime import datetime, timedelta

from django.utils.timezone import now

from orgs.completeness import completeness
from orgs.models import Activity

from .badge import badge_visual_status, earliest_expiry
from .levels import credibility_level
from .models import Verification, VerificationType
from .presence import presence_signals


def vitality_state(org) -> dict:
    level = credibility_level(org)
    visual = badge_visual_status(org)
    expiry = earliest_expiry(org)
    days = None
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        days = (expiry_dt.date() - now().date()).days

    has_traction = org.verifications.filter(
        type__in=[
            VerificationType.STRIPE_TRACTION,
            VerificationType.OPEN_BANKING,
            VerificationType.SAFT_EFATURA,
        ],
        status=Verification.Status.VERIFIED,
    ).exists()
    recent_activity = Activity.objects.filter(
        org=org, created_at__gte=now() - timedelta(days=30)
    ).exists()
    profile_pct = completeness(org)

    items = [
        {
            "key": "seal",
            "label": "Credibility seal active",
            "done": level >= 1 and visual in ("verified", "expiring"),
            "hint": "Complete verifications in the Credibility tab.",
        },
        {
            "key": "seal_fresh",
            "label": "Seal not expiring within 30 days",
            "done": days is None or days > 30,
            "hint": "Renew expiring certificates before they lapse.",
        },
        {
            "key": "profile",
            "label": "Profile at least 60% complete",
            "done": profile_pct >= 60,
            "hint": "Fill in Profile fields to strengthen your presence.",
        },
        {
            "key": "activity",
            "label": "Posted an update in the last 30 days",
            "done": recent_activity,
            "hint": "Share a milestone or update from Activity.",
        },
        {
            "key": "traction",
            "label": "Traction source connected",
            "done": has_traction,
            "hint": "Connect Stripe or another traction source (optional).",
        },
    ]
    done_count = sum(1 for item in items if item["done"])
    return {
        "items": items,
        "done_count": done_count,
        "total_count": len(items),
        "presence": presence_signals(org),
        "badge": {
            "level": level,
            "visual_status": visual,
            "valid_until": expiry,
            "days_until_expiry": days,
        },
    }
