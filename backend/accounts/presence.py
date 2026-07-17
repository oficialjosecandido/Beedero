from datetime import timedelta

from django.utils.timezone import now

from analytics.models import PersonProfileView


def person_presence_signals(user, since_days: int = 7) -> dict:
    since = now() - timedelta(days=since_days)
    profile_views = (
        PersonProfileView.objects.filter(subject=user, viewed_at__gte=since)
        .values("viewer")
        .distinct()
        .count()
    )
    return {
        "profile_views": profile_views,
        "since_days": since_days,
        "has_signal": profile_views > 0,
    }
