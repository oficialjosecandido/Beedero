from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.models import DailySiteStats, SitePageView
from analytics.site_traffic import (
    LISBON,
    _client_ip,
    compute_daily_site_stats,
    record_site_pageview,
    site_traffic_summary,
    visitor_hash_for_request,
)


def _view_at(moment, visitor_hash, path="/"):
    """A page view at an exact instant — `viewed_at` is auto_now_add."""
    view = SitePageView.objects.create(path=path, visitor_hash=visitor_hash)
    SitePageView.objects.filter(pk=view.pk).update(viewed_at=moment)
    return view


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_record_site_pageview_creates_row(rf):
    request = rf.post("/api/analytics/pageview/", {"path": "/terms"}, REMOTE_ADDR="1.2.3.4")
    request.META["HTTP_USER_AGENT"] = "pytest"

    assert record_site_pageview(request, "/terms") is True
    assert SitePageView.objects.filter(path="/terms").count() == 1


@pytest.mark.django_db
def test_record_site_pageview_skips_api_paths(rf):
    request = rf.post("/api/analytics/pageview/", REMOTE_ADDR="1.2.3.4")
    request.META["HTTP_USER_AGENT"] = "pytest"

    assert record_site_pageview(request, "/api/auth/login") is False
    assert SitePageView.objects.count() == 0


@pytest.mark.django_db
def test_pageview_endpoint(api):
    res = api.post("/api/analytics/pageview/", {"path": "/startups"}, format="json", REMOTE_ADDR="9.9.9.9")
    assert res.status_code == 204
    assert SitePageView.objects.filter(path="/startups").exists()


@pytest.mark.django_db
def test_site_traffic_summary_counts_unique_visitors(rf):
    request = rf.get("/", REMOTE_ADDR="1.1.1.1")
    request.META["HTTP_USER_AGENT"] = "pytest-agent"

    record_site_pageview(request, "/")
    record_site_pageview(request, "/about")

    request_b = rf.get("/", REMOTE_ADDR="2.2.2.2")
    request_b.META["HTTP_USER_AGENT"] = "pytest-agent"
    record_site_pageview(request_b, "/")

    summary = site_traffic_summary()
    assert summary["summary"]["day"]["page_views"] == 3
    assert summary["summary"]["day"]["unique_visitors"] == 2


@pytest.mark.django_db
def test_compute_daily_site_stats_rollup(rf):
    request = rf.get("/", REMOTE_ADDR="3.3.3.3")
    request.META["HTTP_USER_AGENT"] = "pytest-agent"
    record_site_pageview(request, "/terms")

    target = timezone.localdate()
    row = compute_daily_site_stats(target)
    assert row.page_views == 1
    assert row.unique_visitors == 1
    assert DailySiteStats.objects.filter(date=target).exists()


@pytest.mark.django_db
def test_site_traffic_summary_query_count_does_not_grow_with_the_window(
    rf, django_assert_num_queries
):
    """PERF-03: four periods plus a 30-day series used to be ~68 queries."""
    request = rf.get("/", REMOTE_ADDR="4.4.4.4")
    request.META["HTTP_USER_AGENT"] = "pytest-agent"
    for path in ("/", "/about", "/terms"):
        record_site_pageview(request, path)

    with django_assert_num_queries(4):
        site_traffic_summary()


@pytest.mark.django_db
def test_unique_visitors_are_not_summed_across_days():
    """The same hash on two days is one weekly unique, not two.

    A distinct count isn't additive, so the period totals have to be counted
    over the period — this fails the moment someone sums the daily series.
    """
    today = timezone.now().astimezone(LISBON).date()
    for offset in (0, 1):
        _view_at(
            datetime.combine(today - timedelta(days=offset), time(12, 0), tzinfo=LISBON),
            "repeat-visitor",
        )

    summary = site_traffic_summary()
    assert summary["summary"]["week"]["page_views"] == 2
    assert summary["summary"]["week"]["unique_visitors"] == 1
    assert [row["unique_visitors"] for row in summary["series"][-2:]] == [1, 1]


@pytest.mark.django_db
def test_series_buckets_on_the_lisbon_day_not_the_utc_one():
    """00:30 in Lisbon summer time is 23:30 UTC the day before."""
    day = date(2026, 7, 15)
    moment = datetime.combine(day, time(0, 30), tzinfo=LISBON)
    assert moment.astimezone(ZoneInfo("UTC")).date() == date(2026, 7, 14)

    _view_at(moment, "dst-visitor")

    result = site_traffic_summary(reference=moment)
    assert result["series"][-1]["date"] == day
    assert result["series"][-1]["page_views"] == 1
    assert sum(row["page_views"] for row in result["series"]) == 1
    assert result["summary"]["day"]["page_views"] == 1


@pytest.mark.django_db
def test_days_without_traffic_are_zero_filled():
    today = timezone.now().astimezone(LISBON).date()
    _view_at(datetime.combine(today, time(9, 0), tzinfo=LISBON), "only-visitor")

    series = site_traffic_summary()["series"]
    assert len(series) == 30
    assert [row["date"] for row in series] == [
        today - timedelta(days=offset) for offset in range(29, -1, -1)
    ]
    assert all(row["page_views"] == 0 for row in series[:-1])
    assert series[-1]["page_views"] == 1


@pytest.mark.parametrize(
    "trusted,forwarded,remote,expected",
    [
        # One proxy in front: the rightmost entry is the one it appended, and
        # the invented entry to its left is ignored.
        (1, "9.9.9.9, 203.0.113.5", "10.0.0.1", "203.0.113.5"),
        (1, "203.0.113.5", "10.0.0.1", "203.0.113.5"),
        # Azure App Service appends the client's port.
        (1, "203.0.113.5:54321", "10.0.0.1", "203.0.113.5"),
        (1, "[2001:db8::1]:443", "10.0.0.1", "2001:db8::1"),
        (1, "2001:db8::1", "10.0.0.1", "2001:db8::1"),
        # Two proxies: the client is two from the right.
        (2, "9.9.9.9, 203.0.113.5, 10.0.0.9", "10.0.0.1", "203.0.113.5"),
        # Shorter chain than configured — nothing can be placed, so believe
        # the socket instead of guessing.
        (2, "203.0.113.5", "10.0.0.1", "10.0.0.1"),
        # No proxy configured: the header is not evidence of anything.
        (0, "203.0.113.5", "10.0.0.1", "10.0.0.1"),
        (1, "", "10.0.0.1", "10.0.0.1"),
        (1, "   ,  ", "10.0.0.1", "10.0.0.1"),
        (1, "203.0.113.5", "", "203.0.113.5"),
        (0, "", "", "unknown"),
    ],
)
def test_client_ip_trusts_the_proxy_chain_only(rf, settings, trusted, forwarded, remote, expected):
    settings.TRUSTED_PROXY_COUNT = trusted
    request = rf.get("/", REMOTE_ADDR=remote)
    if forwarded:
        request.META["HTTP_X_FORWARDED_FOR"] = forwarded
    assert _client_ip(request) == expected


def test_forged_forwarded_header_cannot_mint_visitor_identities(rf, settings):
    """One header used to be enough to look like a different visitor on every
    request — inflating the traffic figures and resetting the per-IP limit."""
    settings.TRUSTED_PROXY_COUNT = 1
    hashes = set()
    for claimed in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        request = rf.get("/", REMOTE_ADDR="10.0.0.1")
        request.META["HTTP_USER_AGENT"] = "pytest-agent"
        request.META["HTTP_X_FORWARDED_FOR"] = f"{claimed}, 203.0.113.5:40001"
        hashes.add(visitor_hash_for_request(request))

    assert len(hashes) == 1
