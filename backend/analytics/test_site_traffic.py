import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.models import DailySiteStats, SitePageView
from analytics.site_traffic import compute_daily_site_stats, record_site_pageview, site_traffic_summary


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
