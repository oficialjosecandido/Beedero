"""Recency as a soft ranking signal — never a punitive withdrawal."""

from django.db.models import Max
from django.utils import timezone

from orgs.models import Activity

# Where `prime_last_activity` leaves its answer. A 1-tuple, not the value:
# "no activity at all" is a legitimate result (`None`), and a bare attribute
# could not tell it apart from "not primed".
_PRIMED_ATTR = "_last_activity_cache"


def last_activity_at(org):
    primed = getattr(org, _PRIMED_ATTR, None)
    if primed is not None:
        return primed[0]
    return (
        Activity.objects.filter(org=org).order_by("-created_at").values_list("created_at", flat=True).first()
    )


def last_activity_map(org_ids) -> dict[int, object]:
    """The latest activity timestamp per org, in a single grouped query.

    Only orgs that have any activity appear — callers read it through
    `prime_last_activity`, which fills the gaps with `None`.
    """
    ids = list(dict.fromkeys(org_ids))
    if not ids:
        return {}
    rows = (
        Activity.objects.filter(org_id__in=ids)
        .values("org_id")
        .annotate(last=Max("created_at"))
        .values_list("org_id", "last")
    )
    return dict(rows)


def prime_last_activity(orgs) -> list:
    """Resolve every org's last activity in one query, cached on the instances.

    `recency_factor`, `discovery_score` and `freshness_label` all read it, and
    ranking 500 candidates called it once per org per signal. Returns the orgs
    so it can wrap a list in place.
    """
    orgs = list(orgs)
    latest = last_activity_map(org.id for org in orgs)
    for org in orgs:
        setattr(org, _PRIMED_ATTR, (latest.get(org.id),))
    return orgs


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
