"""Per-person presence: when someone was last here, and which days they came.

Called from FirebaseIDTokenAuthentication on every authenticated request, so
it has to be cheap and must never break sign-in:

* No extra read. The decision uses `user.last_seen_at`, already loaded with
  the user row. A write happens at most once an hour per person, plus once
  on the first request of each new day (Lisbon time), so a day is never
  missed just because the previous visit was 20 minutes before midnight.
* Any database error is swallowed (and logged) inside a savepoint. Losing one
  presence ping is fine; failing someone's request over analytics is not.
"""

import logging
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db import DatabaseError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Same day boundary the admin KPI panel uses (beedero/kpis.py).
LISBON = ZoneInfo("Europe/Lisbon")
SEEN_THROTTLE = timedelta(hours=1)


def local_day(moment):
    return moment.astimezone(LISBON).date()


def record_presence(user, *, at=None) -> bool:
    """Mark `user` as seen at `at` (default: now). Returns True if it wrote."""
    if user is None or not getattr(user, "pk", None):
        return False

    at = at or timezone.now()
    last = user.last_seen_at
    today = local_day(at)
    new_day = last is None or local_day(last) != today
    if not new_day and at - last < SEEN_THROTTLE:
        return False

    from analytics.models import UserActiveDay

    from .models import User

    try:
        with transaction.atomic():
            User.objects.filter(pk=user.pk).update(last_seen_at=at)
            if new_day:
                # update_conflicts: if a backfill already wrote today as
                # inferred, a real observation upgrades it.
                UserActiveDay.objects.bulk_create(
                    [UserActiveDay(user_id=user.pk, day=today, inferred=False)],
                    update_conflicts=True,
                    unique_fields=["user", "day"],
                    update_fields=["inferred"],
                )
    except DatabaseError:
        logger.warning("record_presence failed for user %s", user.pk, exc_info=True)
        return False

    user.last_seen_at = at
    return True
