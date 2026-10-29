"""The Overview: one payload with every number the admins look at.

Definitions (also in the Nexus md):
  - "people" = real accounts: not staff, not internal (test, team);
  - days are Lisbon days;
  - "active" = at least one authenticated request that day
    (analytics.UserActiveDay — observed, plus the backfill before tracking);
  - numbers about private rows (connections, messages, reactions, comments,
    all posts) come from the nightly rollup (nexus/rollup.py); everything
    else is read live.

The north star is **confirmations per week**: the facts that someone other
than the person or company confirmed — roles confirmed by both sides,
connections accepted, company registries verified, investments confirmed by
both sides. It is what Beedero is for ("here what counts is what others
confirm"), and it only grows when the network is being used for real.
"""

from datetime import datetime, time, timedelta
from statistics import median

from django.db.models import Count, Q
from django.utils import timezone

from accounts.activity import LISBON, local_day
from accounts.ladder import with_unlock
from accounts.models import InvestorProfile, User
from affiliations.models import Affiliation
from analytics.models import (
    DailySiteStats,
    InterestSignal,
    PersonProfileView,
    PipelineEntry,
    ProfileView,
    SitePageView,
    UserActiveDay,
)
from credibility.models import Verification, VerificationType
from investments.models import InvestmentRecord
from jobs.models import Application, JobPost
from messaging.models import MessageReport
from orgs.ladder import listed_in_discover
from orgs.models import Activity, FundraiseRound, Organization, Visibility

from .billing import revenue_summary
from .models import DailyPlatformStats

SERIES_DAYS = 30
COHORT_WEEKS = 8


def people():
    return User.objects.filter(is_staff=False, is_internal=False)


def _day_start(day) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LISBON)


def _pct(part, whole):
    return round(100 * part / whole) if whole else None


def _card(key, label, value, *, unit="", previous=None, hint="", good_when_up=True):
    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": unit,
        "previous": previous,
        "hint": hint,
        "good_when_up": good_when_up,
    }


def _public_posts():
    return Activity.objects.filter(Q(visibility=Visibility.PUBLIC) | Q(org__isnull=True))


def _rollup_sum(field: str, first, last) -> int | None:
    rows = DailyPlatformStats.objects.filter(date__gte=first, date__lte=last)
    if not rows.exists():
        return None
    return sum(getattr(row, field) for row in rows)


def confirmations(start, end) -> dict:
    """The north star, split by kind, between two moments."""
    rollup_first, rollup_last = local_day(start), local_day(end - timedelta(seconds=1))
    connections = _rollup_sum("connections_new", rollup_first, rollup_last)
    parts = {
        "roles": Affiliation.objects.filter(
            status=Affiliation.Status.VERIFIED, verified_at__gte=start, verified_at__lt=end
        ).count(),
        "connections": connections or 0,
        "registries": Verification.objects.filter(
            type=VerificationType.COMPANY_REGISTRY,
            status=Verification.Status.VERIFIED,
            reviewed_at__gte=start,
            reviewed_at__lt=end,
        ).count(),
        "investments": InvestmentRecord.objects.filter(
            status=InvestmentRecord.Status.CONFIRMED, confirmed_at__gte=start, confirmed_at__lt=end
        ).count(),
    }
    return {"total": sum(parts.values()), "parts": parts, "connections_known": connections is not None}


def _series(days: list, values: dict) -> list[dict]:
    return [{"date": day.isoformat(), "value": values.get(day, 0)} for day in days]


def _median_days(pairs) -> float | None:
    spans = [(end - start).total_seconds() / 86400 for start, end in pairs if start and end and end >= start]
    return round(median(spans), 1) if spans else None


def _active_users(first_day, last_day) -> int:
    return (
        UserActiveDay.objects.filter(day__gte=first_day, day__lte=last_day, user__in=people())
        .values("user")
        .distinct()
        .count()
    )


def retention_cohorts(today, weeks: int = COHORT_WEEKS) -> list[dict]:
    """People who joined in each of the last `weeks` weeks (Monday to Sunday,
    Lisbon), and the share active in each following week."""
    this_monday = today - timedelta(days=today.weekday())
    cohorts = []
    for back in range(weeks, 0, -1):
        monday = this_monday - timedelta(weeks=back)
        start, end = _day_start(monday), _day_start(monday + timedelta(days=7))
        ids = list(people().filter(date_joined__gte=start, date_joined__lt=end).values_list("id", flat=True))
        active = {}
        for user_id, day in UserActiveDay.objects.filter(user_id__in=ids, day__gte=monday).values_list(
            "user_id", "day"
        ):
            week = (day - monday).days // 7
            if week >= 1:
                active.setdefault(week, set()).add(user_id)
        complete_weeks = (this_monday - monday).days // 7 - 1
        cohorts.append(
            {
                "week_of": monday.isoformat(),
                "size": len(ids),
                "weeks": [_pct(len(active.get(week, ())), len(ids)) for week in range(1, complete_weeks + 1)],
            }
        )
    return cohorts


def overview(now=None) -> dict:
    now = now or timezone.now()
    today = local_day(now)
    day_start = _day_start(today)
    week_ago, two_weeks_ago = now - timedelta(days=7), now - timedelta(days=14)
    month_ago = now - timedelta(days=30)
    base = people()

    # ---- north star
    this_week = confirmations(_day_start(today - timedelta(days=6)), now)
    last_week = confirmations(_day_start(today - timedelta(days=13)), _day_start(today - timedelta(days=6)))

    # ---- growth
    people_total = base.count()
    new_7 = base.filter(date_joined__gte=week_ago).count()
    new_prev_7 = base.filter(date_joined__gte=two_weeks_ago, date_joined__lt=week_ago).count()
    in_discover = with_unlock(InvestorProfile.objects.filter(user__in=base)).count()
    orgs_live = Organization.objects.filter(status=Organization.Status.LIVE).count()
    orgs_new_7 = Organization.objects.filter(created_at__gte=week_ago).count()
    orgs_listed = listed_in_discover(Organization.objects.all()).count()

    # ---- engagement (active days)
    dau = _active_users(today, today)
    wau = _active_users(today - timedelta(days=6), today)
    mau = _active_users(today - timedelta(days=29), today)
    daily = dict(
        UserActiveDay.objects.filter(day__gte=today - timedelta(days=29), user__in=base)
        .values_list("day")
        .annotate(n=Count("user", distinct=True))
    )
    avg_dau = sum(daily.values()) / 30 if daily else 0
    wau_prev = _active_users(today - timedelta(days=13), today - timedelta(days=7))

    yesterday = today - timedelta(days=1)
    rollup_week = {
        field: _rollup_sum(field, today - timedelta(days=6), today)
        for field in ("connections_new", "messages_new", "reactions_new", "comments_new", "posts_new")
    }
    rollup_prev = {
        field: _rollup_sum(field, today - timedelta(days=13), today - timedelta(days=7))
        for field in rollup_week
    }
    latest_rollup = DailyPlatformStats.objects.order_by("-date").first()

    # ---- activation
    cohort = list(base.filter(date_joined__gte=month_ago).select_related("investorprofile"))
    unlocked_7d = sum(
        1
        for user in cohort
        if getattr(user, "investorprofile", None)
        and user.investorprofile.discoverable_since
        and user.investorprofile.discoverable_since - user.date_joined <= timedelta(days=7)
    )
    unlock_times = InvestorProfile.objects.filter(
        user__in=base, discoverable_since__gte=now - timedelta(days=90)
    ).values_list("user__date_joined", "discoverable_since")
    orgs_cohort = Organization.objects.filter(created_at__gte=month_ago)
    orgs_published = orgs_cohort.filter(discoverable_since__isnull=False).count()
    publish_times = Organization.objects.filter(discoverable_since__gte=now - timedelta(days=90)).values_list(
        "created_at", "discoverable_since"
    )

    # ---- trust & safety
    pending = Verification.objects.filter(status=Verification.Status.PENDING)
    oldest = pending.order_by("submitted_at").values_list("submitted_at", flat=True).first()

    # ---- marketplace
    views_7 = ProfileView.objects.filter(viewed_at__gte=week_ago).count() + PersonProfileView.objects.filter(
        viewed_at__gte=week_ago
    ).count()

    # ---- traffic
    site_week = DailySiteStats.objects.filter(date__gte=today - timedelta(days=7), date__lt=today)
    visitors_today = SitePageView.objects.filter(viewed_at__gte=day_start).values("visitor_hash").distinct().count()

    revenue = revenue_summary(now)

    sections = [
        {
            "key": "today",
            "title": "Today",
            "cards": [
                _card("people_new_today", "New people", base.filter(date_joined__gte=day_start).count()),
                _card("active_today", "Active people", dau),
                _card(
                    "orgs_new_today", "New organisations", Organization.objects.filter(created_at__gte=day_start).count()
                ),
                _card(
                    "public_posts_today",
                    "Public posts",
                    _public_posts().filter(created_at__gte=day_start).count(),
                    hint="Public only — all posts come from the nightly count.",
                ),
                _card("visitors_today", "Site visitors", visitors_today),
            ],
        },
        {
            "key": "growth",
            "title": "Growth",
            "cards": [
                _card("people_total", "People", people_total),
                _card("people_new_7", "New people (7d)", new_7, previous=new_prev_7),
                _card("in_discover", "People in Discover", in_discover, hint="Past the 50% gate of their ladder."),
                _card("orgs_live", "Live organisations", orgs_live),
                _card("orgs_listed", "Organisations in Discover", orgs_listed, hint="Live, past the gate, with a plan."),
                _card("orgs_new_7", "New organisations (7d)", orgs_new_7),
            ],
        },
        {
            "key": "engagement",
            "title": "Engagement",
            "cards": [
                _card("dau", "Active today", dau),
                _card("wau", "Active (7d)", wau, previous=wau_prev),
                _card("mau", "Active (30d)", mau),
                _card(
                    "stickiness",
                    "Stickiness",
                    _pct(avg_dau, mau),
                    unit="%",
                    hint="Average daily active ÷ monthly active.",
                ),
                _card(
                    "connections_7",
                    "Connections (7d)",
                    rollup_week["connections_new"],
                    previous=rollup_prev["connections_new"],
                ),
                _card("messages_7", "Messages (7d)", rollup_week["messages_new"], previous=rollup_prev["messages_new"]),
                _card("posts_7", "Posts (7d)", rollup_week["posts_new"], previous=rollup_prev["posts_new"]),
                _card(
                    "reactions_7",
                    "Reactions + comments (7d)",
                    None
                    if rollup_week["reactions_new"] is None
                    else rollup_week["reactions_new"] + (rollup_week["comments_new"] or 0),
                ),
            ],
        },
        {
            "key": "activation",
            "title": "Activation",
            "cards": [
                _card(
                    "unlock_7d",
                    "In Discover within 7 days",
                    _pct(unlocked_7d, len(cohort)),
                    unit="%",
                    hint="People who joined in the last 30 days.",
                ),
                _card("unlock_median", "Days to Discover (median)", _median_days(unlock_times), good_when_up=False),
                _card(
                    "orgs_published",
                    "Organisations published",
                    _pct(orgs_published, orgs_cohort.count()),
                    unit="%",
                    hint="Created in the last 30 days.",
                ),
                _card("publish_median", "Days to publish (median)", _median_days(publish_times), good_when_up=False),
            ],
        },
        {
            "key": "revenue",
            "title": "Revenue",
            "cards": [
                _card("mrr", "MRR", revenue["mrr_cents"], unit="cents", hint="VAT included."),
                _card("mrr_net", "MRR without VAT", revenue["mrr_net_cents"], unit="cents"),
                _card("paying_orgs", "Paying organisations", revenue["paying_orgs"]),
                _card("free_periods", "In their free year", revenue["free_periods_active"]),
                _card(
                    "free_ending",
                    "Free year ends in 30 days",
                    revenue["free_periods_ending_30d"],
                    good_when_up=False,
                ),
                _card(
                    "conversion",
                    "Free year → paid",
                    revenue["conversion_pct"],
                    unit="%",
                    hint="Free years that ended in the last 12 months.",
                ),
                _card("past_due", "Payment failing", revenue["past_due"], good_when_up=False),
            ],
        },
        {
            "key": "trust",
            "title": "Trust & safety",
            "cards": [
                _card(
                    "reports_open",
                    "Open reports",
                    MessageReport.objects.filter(resolved_at__isnull=True).count(),
                    good_when_up=False,
                ),
                _card(
                    "verifications_pending",
                    "Verifications waiting",
                    pending.count(),
                    hint=f"Oldest: {(now - oldest).days} days" if oldest else "",
                    good_when_up=False,
                ),
                _card(
                    "verifications_expiring",
                    "Verifications expiring (30d)",
                    Verification.objects.filter(
                        status=Verification.Status.VERIFIED, valid_until__lt=now + timedelta(days=30)
                    ).count(),
                    good_when_up=False,
                ),
                _card(
                    "posts_removed_30",
                    "Posts removed (30d)",
                    Activity.all_objects.filter(removed_at__gte=month_ago).count(),
                    good_when_up=False,
                ),
                _card(
                    "suspended",
                    "Suspended accounts",
                    User.objects.filter(is_active=False, is_internal=False).count(),
                    good_when_up=False,
                ),
            ],
        },
        {
            "key": "marketplace",
            "title": "Founders ↔ investors",
            "cards": [
                _card("profile_views_7", "Profile views (7d)", views_7),
                _card(
                    "interest_7", "Interest signals (7d)", InterestSignal.objects.filter(created_at__gte=week_ago).count()
                ),
                _card(
                    "pipeline_active",
                    "Startups in investor pipelines",
                    PipelineEntry.objects.exclude(stage=PipelineEntry.Stage.PASSED).count(),
                ),
                _card("rounds_open", "Open rounds", FundraiseRound.objects.filter(is_open=True).count()),
                _card("jobs_open", "Open jobs", JobPost.objects.filter(status=JobPost.Status.OPEN).count()),
                _card(
                    "applications_7",
                    "Job applications (7d)",
                    Application.objects.filter(created_at__gte=week_ago).count(),
                ),
            ],
        },
        {
            "key": "traffic",
            "title": "Site traffic",
            "cards": [
                _card("visitors_7", "Visitors (7d)", sum(row.unique_visitors for row in site_week) or None),
                _card("page_views_7", "Page views (7d)", sum(row.page_views for row in site_week) or None),
            ],
        },
    ]

    days = [today - timedelta(days=offset) for offset in range(SERIES_DAYS - 1, -1, -1)]
    first = days[0]
    signups = _count_by_day(base.filter(date_joined__gte=_day_start(first)).values_list("date_joined", flat=True))
    rollups = {row.date: row for row in DailyPlatformStats.objects.filter(date__gte=first)}
    site = {row.date: row.unique_visitors for row in DailySiteStats.objects.filter(date__gte=first)}

    return {
        "generated_at": now.isoformat(),
        "north_star": {
            "label": "Confirmations this week",
            "value": this_week["total"],
            "previous": last_week["total"],
            "parts": this_week["parts"],
            "connections_known": this_week["connections_known"],
        },
        "sections": sections,
        "series": {
            "signups": _series(days, signups),
            "active": _series(days, daily),
            "posts": _series(days, {day: row.posts_new for day, row in rollups.items()}),
            "connections": _series(days, {day: row.connections_new for day, row in rollups.items()}),
            "visitors": _series(days, site),
        },
        "funnel": activation_funnel(cohort),
        "cohorts": retention_cohorts(today),
        "rollup": {
            "date": latest_rollup.date.isoformat() if latest_rollup else None,
            "computed_at": latest_rollup.computed_at.isoformat() if latest_rollup else None,
            "requests_pending": latest_rollup.requests_pending if latest_rollup else None,
            "connections_total": latest_rollup.connections_total if latest_rollup else None,
            "fresh": bool(latest_rollup and latest_rollup.date >= yesterday),
        },
        "revenue": revenue,
    }


def _count_by_day(moments) -> dict:
    counts: dict = {}
    for moment in moments:
        day = local_day(moment)
        counts[day] = counts.get(day, 0) + 1
    return counts


def _profile_has(user, field: str) -> bool:
    profile = getattr(user, "investorprofile", None)
    return bool(profile and getattr(profile, field))


def activation_funnel(cohort: list) -> list[dict]:
    """People who joined in the last 30 days, step by step."""
    from accounts.acquisition import connected_user_ids, returned_user_ids

    ids = [user.id for user in cohort]
    steps = [
        ("Joined", len(cohort)),
        ("Onboarding finished", sum(1 for u in cohort if _profile_has(u, "onboarding_completed_at"))),
        ("In Discover", sum(1 for u in cohort if _profile_has(u, "discoverable_since"))),
        ("First connection of any kind", len(connected_user_ids(ids))),
        ("Came back in week one", len(returned_user_ids(cohort))),
    ]
    out = []
    for index, (label, count) in enumerate(steps):
        out.append({"label": label, "count": count, "pct_of_first": _pct(count, steps[0][1]) if index else 100})
    return out
