"""Weekly posting cadence for a person — Europe/Lisbon ISO weeks, not UTC.

Same calendar rule as orgs/posting/limits.py: a person's week is the week they
actually live in, so a Sunday-night post counts for that Sunday's week and not
the next one.

This is a streak, not a checklist item, and the distinction is the reason this
module exists. A tick that stays green forever after one post would be a lie;
a tick that goes out every Monday inside something called a "ladder" would be
incoherent, because a ladder does not go down. Consecutive weeks say the true
thing: the record is being kept up, or it lapsed and started again.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from orgs.models import Activity

LISBON = ZoneInfo("Europe/Lisbon")

# A personal post is an Activity with no org — the same definition
# accounts/completeness.py uses for `first_post`.
Week = tuple[int, int]


def _week_of(moment: datetime) -> Week:
    """ISO (year, week) of a datetime, read on the Lisbon calendar."""
    year, week, _ = moment.astimezone(LISBON).date().isocalendar()
    return year, week


def _shift(week: Week, weeks: int) -> Week:
    """Step whole ISO weeks through a real date, so neither 52- nor 53-week
    years need special-casing."""
    year, number = week
    monday = date.fromisocalendar(year, number, 1) + timedelta(weeks=weeks)
    shifted_year, shifted_week, _ = monday.isocalendar()
    return shifted_year, shifted_week


def _longest_run(weeks: set[Week]) -> int:
    best = 0
    for week in weeks:
        if _shift(week, -1) in weeks:
            continue  # not the start of a run — it will be counted from there
        length = 0
        cursor = week
        while cursor in weeks:
            length += 1
            cursor = _shift(cursor, 1)
        best = max(best, length)
    return best


def posting_cadence(user) -> dict:
    posted_at = list(
        Activity.objects.filter(author=user, org__isnull=True).values_list("created_at", flat=True)
    )
    weeks = {_week_of(moment) for moment in posted_at}

    now_lisbon = timezone.now().astimezone(LISBON)
    this_week = _week_of(timezone.now())
    posted_this_week = this_week in weeks

    # The count starts from the last week that is already over. Measuring from
    # the current week instead would break every streak on Monday morning,
    # before the person had any chance to post; this week only adds to the
    # total once it actually has a post in it.
    cursor = this_week if posted_this_week else _shift(this_week, -1)
    streak = 0
    while cursor in weeks:
        streak += 1
        cursor = _shift(cursor, -1)

    monday = now_lisbon.date() - timedelta(days=now_lisbon.weekday())
    next_monday = datetime.combine(monday + timedelta(days=7), time.min, tzinfo=LISBON)

    return {
        "posted_this_week": posted_this_week,
        "streak_weeks": streak,
        "best_streak_weeks": _longest_run(weeks),
        "weeks_posted": len(weeks),
        "week_started_on": monday.isoformat(),
        "days_left": (next_monday - now_lisbon).days + 1,
        "last_post_at": max(posted_at).isoformat() if posted_at else None,
    }
