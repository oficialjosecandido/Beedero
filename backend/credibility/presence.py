"""Aggregated presence signals — factual, no names (doc §B2)."""

from datetime import timedelta

from django.utils.timezone import now

from analytics.models import InterestSignal, ProfileView
from orgs.models import OrgFollow


def presence_signals(org, since_days: int = 7) -> dict:
    since = now() - timedelta(days=since_days)
    investor_views = (
        ProfileView.objects.filter(org=org, viewer_is_investor=True, viewed_at__gte=since)
        .values("viewer")
        .distinct()
        .count()
    )
    new_followers = OrgFollow.objects.filter(org=org, created_at__gte=since).count()
    interest = InterestSignal.objects.filter(org=org, created_at__gte=since).count()
    return {
        "investor_views": investor_views,
        "new_followers": new_followers,
        "interest": interest,
        "since_days": since_days,
        "has_signal": any([investor_views, new_followers, interest]),
    }
