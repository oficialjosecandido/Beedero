"""Recency as a soft ranking signal — never a punitive withdrawal."""

from django.utils import timezone

from orgs.models import Activity


def last_activity_at(org):
    return (
        Activity.objects.filter(org=org).order_by("-created_at").values_list("created_at", flat=True).first()
    )


def recency_factor(org) -> float:
    last = last_activity_at(org)
    if last is None:
        return 0.85
    days = (timezone.now() - last).days
    if days <= 14:
        return 1.00
    if days <= 30:
        return 0.95
    if days <= 60:
        return 0.90
    return 0.85


def discovery_score(org) -> float:
    from credibility.levels import credibility_level

    return credibility_level(org) * recency_factor(org)


def freshness_label(org) -> str | None:
    last = last_activity_at(org)
    if last is None:
        return None
    days = (timezone.now() - last).days
    if days == 0:
        return "Updated today"
    if days == 1:
        return "Updated yesterday"
    if days < 30:
        return f"Updated {days} days ago"
    months = max(1, days // 30)
    return f"Updated {months} month{'s' if months > 1 else ''} ago"
