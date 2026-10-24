"""Week cadence — one personal post per Lisbon calendar day.

Same calendar rule as orgs/posting/limits.py: a person's day is the day they
actually live in (Europe/Lisbon), so a late-night post still counts for that
local date.

This is a streak of consecutive days, not a checklist item. A tick that stays
green forever after one post would be a lie; consecutive days say the true
thing: the record is being kept up daily, or it lapsed and started again.

The UI shows the current ISO week (Mon–Sun) as seven day slots — "Week
cadence" — while the streak itself is counted in days.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from orgs.models import Activity

LISBON = ZoneInfo("Europe/Lisbon")


def _day_of(moment: datetime) -> date:
    return moment.astimezone(LISBON).date()


def _longest_run(days: set[date]) -> int:
    best = 0
    for day in days:
        if (day - timedelta(days=1)) in days:
            continue
        length = 0
        cursor = day
        while cursor in days:
            length += 1
            cursor += timedelta(days=1)
        best = max(best, length)
    return best


def _post_times(user) -> list[datetime]:
    return list(
        Activity.objects.filter(author=user, org__isnull=True).values_list("created_at", flat=True)
    )


def longest_daily_run(user) -> int:
    """Longest run of consecutive Lisbon days with at least one personal post.

    Lives here rather than in accounts/ladder.py so that "a day with a post"
    means one thing in the app: the ladder's last rung and this card's streak
    are the same count, read off the same calendar.
    """
    return _longest_run({_day_of(moment) for moment in _post_times(user)})


def posting_cadence(user) -> dict:
    posted_at = _post_times(user)
    days = {_day_of(moment) for moment in posted_at}

    now_lisbon = timezone.now().astimezone(LISBON)
    today = now_lisbon.date()
    posted_today = today in days

    # Count from yesterday when today is still empty — otherwise every streak
    # would read zero every morning before the person has had a chance to post.
    cursor = today if posted_today else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)

    monday = today - timedelta(days=today.weekday())
    week_days = [(monday + timedelta(days=offset)) in days for offset in range(7)]

    tomorrow = datetime.combine(today + timedelta(days=1), time.min, tzinfo=LISBON)
    hours_left = max(0, int((tomorrow - now_lisbon).total_seconds() // 3600))

    return {
        "posted_today": posted_today,
        "streak_days": streak,
        "best_streak_days": _longest_run(days),
        "days_posted": len(days),
        "week_started_on": monday.isoformat(),
        "week_days": week_days,
        "today_index": today.weekday(),  # Mon=0 … Sun=6 on the Lisbon calendar
        "hours_left": hours_left,
        "last_post_at": max(posted_at).isoformat() if posted_at else None,
    }
