import hashlib
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
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


def _strip_port(address: str) -> str:
    """`1.2.3.4:5678` -> `1.2.3.4`; a bare IPv6 address is left alone.

    Azure App Service writes the client's port into X-Forwarded-For, and the
    port changes on every connection — left in, it would make each request
    look like a new visitor and give each one its own rate-limit budget.
    """
    address = address.strip()
    if address.startswith("["):  # [2001:db8::1]:443
        host, _, _ = address[1:].partition("]")
        return host
    host, sep, port = address.rpartition(":")
    if sep and host and ":" not in host and port.isdigit():
        return host
    return address


def _client_ip(request) -> str:
    """The caller's address, trusting X-Forwarded-For only as far as the proxy
    chain in front of us.

    Each proxy appends the address it received the request from, so with
    `TRUSTED_PROXY_COUNT` proxies in front, the client is that many entries
    from the right. Everything to the left of those was written by the caller
    and can say anything: reading the leftmost entry (which this did) let
    anyone mint unlimited visitor identities with one header, inflating the
    traffic figures and handing themselves a fresh rate-limit budget per
    request.
    """
    trusted = getattr(settings, "TRUSTED_PROXY_COUNT", 0)
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if trusted and forwarded:
        parts = [part for part in (p.strip() for p in forwarded.split(",")) if part]
        # Fewer entries than proxies means the chain isn't what we were told
        # it is, so none of them can be placed: fall through to REMOTE_ADDR,
        # which is the one address nobody upstream can forge.
        if len(parts) >= trusted:
            return _strip_port(parts[-trusted])
    return _strip_port(request.META.get("REMOTE_ADDR", "")) or "unknown"


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


# Longest window the summary reports, and the one every other period is a
# suffix of — which is what lets all four be counted in a single pass.
SUMMARY_PERIOD_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365}
SERIES_DAYS = 30


def _period_stats(today: date) -> dict[str, dict[str, int]]:
    """day/week/month/year totals in one query.

    Every period ends at the end of today, so each is just a different
    `viewed_at >= start` over the same rows — conditional aggregation, instead
    of two queries per period. Uniques are counted per period rather than
    summed from the daily series on purpose: a distinct visitor count is not
    additive across days, and the fact that `visitor_hash_for_request` happens
    to re-salt daily is an implementation detail this must not depend on.
    """
    oldest = max(SUMMARY_PERIOD_DAYS.values())
    window_start, _ = _day_bounds(today - timedelta(days=oldest - 1))
    _, window_end = _day_bounds(today)

    aggregates = {}
    for key, days in SUMMARY_PERIOD_DAYS.items():
        since = Q(viewed_at__gte=_day_bounds(today - timedelta(days=days - 1))[0])
        aggregates[f"{key}__page_views"] = Count("id", filter=since)
        aggregates[f"{key}__unique_visitors"] = Count("visitor_hash", distinct=True, filter=since)

    row = SitePageView.objects.filter(
        viewed_at__gte=window_start, viewed_at__lt=window_end
    ).aggregate(**aggregates)

    stats: dict[str, dict[str, int]] = {key: {} for key in SUMMARY_PERIOD_DAYS}
    for name, value in row.items():
        key, metric = name.split("__")
        stats[key][metric] = value or 0
    return stats


def _daily_series(today: date) -> list[dict]:
    """The last `SERIES_DAYS` days, one grouped query instead of two per day.

    Grouping on the Lisbon date rather than the stored UTC timestamp keeps the
    buckets identical to the ones `_day_bounds` produces, so a row can never
    land in a different day here than in the rollup table.
    """
    first_day = today - timedelta(days=SERIES_DAYS - 1)
    start_dt, _ = _day_bounds(first_day)
    _, end_dt = _day_bounds(today)

    rows = (
        SitePageView.objects.filter(viewed_at__gte=start_dt, viewed_at__lt=end_dt)
        .annotate(day=TruncDate("viewed_at", tzinfo=LISBON))
        .values("day")
        .annotate(
            page_views=Count("id"),
            unique_visitors=Count("visitor_hash", distinct=True),
        )
    )
    by_day = {row["day"]: row for row in rows}

    series = []
    for offset in range(SERIES_DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        counts = by_day.get(day)
        series.append(
            {
                "date": day,
                "label": day.strftime("%d/%m"),
                "page_views": counts["page_views"] if counts else 0,
                "unique_visitors": counts["unique_visitors"] if counts else 0,
            }
        )
    return series


def site_traffic_summary(*, reference: datetime | None = None) -> dict:
    """Visitor and page-view totals for day/week/month/year (Lisbon calendar)."""
    reference = reference or timezone.now()
    today = reference.astimezone(LISBON).date()

    summary = _period_stats(today)
    series = _daily_series(today)

    max_views = max((row["page_views"] for row in series), default=0) or 1
    for row in series:
        row["bar_width"] = int(row["page_views"] / max_views * 220)

    month_start, _ = _day_bounds(today - timedelta(days=SERIES_DAYS - 1))
    top_paths = list(
        SitePageView.objects.filter(viewed_at__gte=month_start)
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
