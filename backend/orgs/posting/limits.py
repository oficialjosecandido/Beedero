"""Posting cadence — Europe/Lisbon calendar, not UTC."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from orgs.models import Activity

LISBON = ZoneInfo("Europe/Lisbon")

DAILY_LIMIT_MESSAGE = "You already posted today. Tomorrow there's another — choose your next one well."


def _lisbon_now() -> datetime:
    return timezone.now().astimezone(LISBON)


def last_org_post(org):
    return Activity.objects.filter(org=org).order_by("-created_at").first()


def can_post_now(org, min_days_between: int) -> tuple[bool, datetime | None]:
    """Return (allowed, next_slot_at). Deleting today's post restores the slot."""
    last = last_org_post(org)
    if last is None:
        return True, None

    now_lisbon = _lisbon_now()
    last_lisbon = last.created_at.astimezone(LISBON)

    if min_days_between <= 1:
        if last_lisbon.date() >= now_lisbon.date():
            next_slot = datetime.combine(now_lisbon.date() + timedelta(days=1), time.min, tzinfo=LISBON)
            return False, next_slot
        return True, None

    days_since = (now_lisbon.date() - last_lisbon.date()).days
    if days_since < min_days_between:
        next_date = last_lisbon.date() + timedelta(days=min_days_between)
        next_slot = datetime.combine(next_date, time.min, tzinfo=LISBON)
        return False, next_slot
    return True, None
