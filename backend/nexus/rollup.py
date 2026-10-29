"""The nightly count of what row-level security keeps private.

Connections, connection requests, messages, reactions, comments and
members-only posts are visible only to the people involved. The Nexus never
reads those rows. This job counts them the way the policies already allow —
setting the viewer to each person in turn and counting only that person's own
rows (the same approach as analytics' backfill_active_days) — and keeps just
the totals, one row per day.

Only real people count: staff and internal (test, team) accounts are left out,
on both sides of a connection.
"""

from collections import Counter
from datetime import date, datetime, time, timedelta

from django.db import connection, transaction
from django.utils import timezone

from accounts.activity import LISBON, local_day
from accounts.models import User

from .models import DailyPlatformStats

_DAY = "(created_at AT TIME ZONE 'Europe/Lisbon')::date"

QUERIES = {
    # Each connection once: from its user_one side, when both are people.
    "connections": (
        f"SELECT {_DAY}, count(*) FROM connections_connection "
        "WHERE user_one_id = %s AND user_two_id = ANY(%s) AND created_at >= %s GROUP BY 1"
    ),
    "messages": (
        f"SELECT {_DAY}, count(*) FROM messaging_message WHERE sender_id = %s AND created_at >= %s GROUP BY 1"
    ),
    "reactions": f"SELECT {_DAY}, count(*) FROM social_reaction WHERE user_id = %s AND created_at >= %s GROUP BY 1",
    "comments": (
        f"SELECT {_DAY}, count(*) FROM social_comment "
        "WHERE author_id = %s AND deleted_at IS NULL AND created_at >= %s GROUP BY 1"
    ),
    "posts": (
        f"SELECT {_DAY}, count(*) FROM orgs_activity "
        "WHERE author_id = %s AND removed_at IS NULL AND created_at >= %s GROUP BY 1"
    ),
}
CONNECTIONS_BEFORE = (
    "SELECT count(*) FROM connections_connection WHERE user_one_id = %s AND user_two_id = ANY(%s) AND created_at < %s"
)
PENDING_REQUESTS = (
    "SELECT count(*) FROM connections_connectionrequest "
    "WHERE requester_id = %s AND recipient_id = ANY(%s) AND status = 'pending'"
)


def people_ids() -> list[int]:
    return list(User.objects.filter(is_staff=False, is_internal=False).values_list("id", flat=True))


def _start_of(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LISBON)


def count_for_viewer(cursor, viewer_id: int, people: list[int], since: datetime) -> dict:
    """One person's own rows, by day. Call inside a transaction: the viewer
    is set with `set_config(..., true)`, which lasts until it ends."""
    cursor.execute("SELECT set_config('beedero.viewer_id', %s, true)", [str(viewer_id)])
    by_day: dict[str, Counter] = {}
    for name, sql in QUERIES.items():
        params = [viewer_id, people, since] if name == "connections" else [viewer_id, since]
        cursor.execute(sql, params)
        by_day[name] = Counter({day: count for day, count in cursor.fetchall()})
    cursor.execute(CONNECTIONS_BEFORE, [viewer_id, people, since])
    before = cursor.fetchone()[0]
    cursor.execute(PENDING_REQUESTS, [viewer_id, people])
    pending = cursor.fetchone()[0]
    return {"by_day": by_day, "connections_before": before, "requests_pending": pending}


def compute(days: int = 2, today: date | None = None) -> list[DailyPlatformStats]:
    """Recount the last `days` days (today included) and store them."""
    if connection.vendor != "postgresql":
        return []
    today = today or local_day(timezone.now())
    first = today - timedelta(days=days - 1)
    since = _start_of(first)
    people = people_ids()
    totals = {name: Counter() for name in QUERIES}
    connections_before = pending = 0

    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('beedero.viewer_id', true)")
        previous = cursor.fetchone()[0] or "0"
        try:
            for viewer_id in people:
                counted = count_for_viewer(cursor, viewer_id, people, since)
                for name, counter in counted["by_day"].items():
                    totals[name].update(counter)
                connections_before += counted["connections_before"]
                pending += counted["requests_pending"]
        finally:
            cursor.execute("SELECT set_config('beedero.viewer_id', %s, true)", [previous])

    rows = []
    running = connections_before
    for offset in range(days):
        day = first + timedelta(days=offset)
        running += totals["connections"][day]
        row, _ = DailyPlatformStats.objects.update_or_create(
            date=day,
            defaults={
                "connections_total": running,
                "connections_new": totals["connections"][day],
                "messages_new": totals["messages"][day],
                "reactions_new": totals["reactions"][day],
                "comments_new": totals["comments"][day],
                "posts_new": totals["posts"][day],
            },
        )
        rows.append(row)
    DailyPlatformStats.objects.filter(date=today).update(requests_pending=pending)
    return rows
