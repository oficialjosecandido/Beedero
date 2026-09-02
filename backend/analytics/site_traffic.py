import hashlib
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from .models import DailySiteStats, SitePageView

LISBON = ZoneInfo("Europe/Lisbon")
TRACKED_PATH_PREFIXES = (
    "/",
    "/about",
    "/cookies",
    "/disputes",
    "/feed",
    "/login",
    "/privacy",
    "/register",
    "/startups",
    "/terms",
    "/p/",
    "/o/",
    "/verify/",
)


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def visitor_hash_for_request(request) -> str:
    ip = _client_ip(request)
    user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:200]
    today = timezone.now().astimezone(LISBON).date().isoformat()
    salt = getattr(settings, "SITE_ANALYTICS_SALT", settings.SECRET_KEY)
    digest = hashlib.sha256(f"{today}:{ip}:{user_agent}:{salt}".encode()).hexdigest()
    return digest[:32]


def is_trackable_path(path: str) -> bool:
    if not path or not path.startswith("/"):
        return False
    if path.startswith("/api/") or path.startswith("/_next/") or path.startswith("/admin"):
        return False
    return path == "/" or any(
        path == prefix or path.startswith(prefix)
        for prefix in TRACKED_PATH_PREFIXES
        if prefix != "/"
    )


def record_site_pageview(request, path: str) -> bool:
    normalized = path.split("?", 1)[0].strip() or "/"
    if not is_trackable_path(normalized):
        return False

    user = getattr(request, "user", None)
    is_authenticated = bool(getattr(user, "is_authenticated", False) and user.is_authenticated)

    SitePageView.objects.create(
        path=normalized[:300],
        visitor_hash=visitor_hash_for_request(request),
        is_authenticated=is_authenticated,
    )
    return True


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=LISBON)
    return start, start + timedelta(days=1)


def _stats_between(start: datetime, end: datetime) -> dict[str, int]:
    qs = SitePageView.objects.filter(viewed_at__gte=start, viewed_at__lt=end)
    return {
        "page_views": qs.count(),
        "unique_visitors": qs.values("visitor_hash").distinct().count(),
    }


def site_traffic_summary(*, reference: datetime | None = None) -> dict:
    """Visitor and page-view totals for day/week/month/year (Lisbon calendar)."""
    reference = reference or timezone.now()
    today = reference.astimezone(LISBON).date()

    periods = {
        "day": (today, today),
        "week": (today - timedelta(days=6), today),
        "month": (today - timedelta(days=29), today),
        "year": (today - timedelta(days=364), today),
    }

    summary = {}
    for key, (start_day, end_day) in periods.items():
        start_dt, _ = _day_bounds(start_day)
        _, end_dt = _day_bounds(end_day)
        summary[key] = _stats_between(start_dt, end_dt)

    series = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        start_dt, end_dt = _day_bounds(day)
        stats = _stats_between(start_dt, end_dt)
        series.append(
            {
                "date": day,
                "label": day.strftime("%d/%m"),
                "page_views": stats["page_views"],
                "unique_visitors": stats["unique_visitors"],
            }
        )

    max_views = max((row["page_views"] for row in series), default=0) or 1
    for row in series:
        row["bar_width"] = int(row["page_views"] / max_views * 220)

    top_paths = list(
        SitePageView.objects.filter(viewed_at__gte=_day_bounds(today - timedelta(days=29))[0])
        .values("path")
        .annotate(views=Count("id"))
        .order_by("-views")[:10]
    )

    latest_rollup = DailySiteStats.objects.order_by("-date").values_list("date", flat=True).first()

    return {
        "generated_at": reference,
        "summary": summary,
        "series": series,
        "top_paths": top_paths,
        "latest_rollup": latest_rollup,
    }


def compute_daily_site_stats(target_date: date) -> DailySiteStats:
    start_dt, end_dt = _day_bounds(target_date)
    stats = _stats_between(start_dt, end_dt)
    row, _ = DailySiteStats.objects.update_or_create(
        date=target_date,
        defaults={
            "page_views": stats["page_views"],
            "unique_visitors": stats["unique_visitors"],
        },
    )
    return row
