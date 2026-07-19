"""Private vitality checklist for founders (doc §B5) — not a public score."""

from datetime import timedelta

from django.utils.timezone import now

from orgs.completeness import completeness
from orgs.models import Activity

from .presence import presence_signals


def vitality_state(org) -> dict:
    recent_activity = Activity.objects.filter(
        org=org, created_at__gte=now() - timedelta(days=30)
    ).exists()
    profile_pct = completeness(org)

    items = [
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
    ]
    done_count = sum(1 for item in items if item["done"])
    return {
        "items": items,
        "done_count": done_count,
        "total_count": len(items),
        "presence": presence_signals(org),
        "badge": {
            "level": 0,
            "visual_status": "unverified",
            "valid_until": None,
            "days_until_expiry": None,
        },
    }
