from django.shortcuts import render
from django.utils.timezone import now
from django.views.decorators.cache import cache_page

from analytics.site_traffic import site_traffic_summary

from .admin_access import kpi_admin_required


@kpi_admin_required
@cache_page(60 * 2)
def site_analytics_view(request):
    data = site_traffic_summary(reference=now())
    return render(
        request,
        "admin/site_analytics.html",
        {
            "title": "Site analytics",
            "generated_at": data["generated_at"],
            "summary": data["summary"],
            "series": data["series"],
            "top_paths": data["top_paths"],
            "latest_rollup": data["latest_rollup"],
        },
    )
