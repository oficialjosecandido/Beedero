"""Public SEO endpoints — sitemap data and unauthenticated discovery.

On why there is no IP throttle here, deliberately: every one of these is
called server-side by Next.js (`publicFetch` in frontend/lib/api.ts is
`server-only`, and forwards none of the visitor's headers), so the backend
sees one client — the frontend host — for all of this traffic. An IP throttle
would therefore not slow a scraper down by a single request; it would take
the public site offline the moment it grew popular. The bounds below are the
protection instead: no response here can be made to grow without limit, and
nothing here carries a field that isn't already on the indexable page it
points at. The authenticated listings in orgs/views.py are where the rate
limits live, because there the caller is a person rather than a cache.
"""

from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import InvestorProfile

from .discovery import discover
from .models import Organization
from .serializers import _org_summary

# The sitemaps protocol's own ceiling (50,000 URLs per file), used here as the
# response bound. Passing it means it's time to split into a sitemap index,
# not to raise this number — Google would ignore the overflow either way.
MAX_SITEMAP_ENTRIES = 50_000


def _parse_limit_offset(request, default_limit=24, max_limit=50):
    try:
        limit = int(request.query_params.get("limit", default_limit))
    except (TypeError, ValueError):
        return None, None, Response({"detail": "Invalid limit."}, status=400)
    limit = max(1, min(limit, max_limit))

    try:
        offset = max(0, int(request.query_params.get("offset", 0)))
    except (TypeError, ValueError):
        return None, None, Response({"detail": "Invalid offset."}, status=400)

    return limit, offset, None


class PublicSitemapView(APIView):
    """GET /api/public/sitemap/ — slugs for indexable public profile URLs."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        # values_list, not model instances: this builds tens of thousands of
        # entries and needs three columns of each.
        orgs = (
            Organization.objects.filter(status=Organization.Status.LIVE)
            .order_by("slug")
            .values_list("slug", "created_at", "is_verified")[:MAX_SITEMAP_ENTRIES]
        )
        org_entries = []
        verify_entries = []
        for slug, created_at, is_verified in orgs:
            entry = {"slug": slug, "lastmod": created_at.date().isoformat()}
            org_entries.append(entry)
            if is_verified:
                verify_entries.append(entry)

        people = (
            InvestorProfile.objects.filter(handle__isnull=False)
            .exclude(handle="")
            .exclude(full_name="")
            .exclude(headline="")
            .exclude(country="")
            .order_by("handle")
            .values_list("handle", "user__date_joined")[:MAX_SITEMAP_ENTRIES]
        )
        people_entries = [
            {"handle": handle, "lastmod": date_joined.date().isoformat()}
            for handle, date_joined in people
        ]

        return Response(
            {
                "orgs": org_entries,
                "people": people_entries,
                "verify": verify_entries,
            }
        )


class PublicDiscoveryView(APIView):
    """GET /api/public/discovery/ — crawlable org directory (public fields only)."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        limit, offset, error = _parse_limit_offset(request)
        if error is not None:
            return error

        params = request.query_params.copy()
        for key in ("metric", "metric_min", "min_credibility", "sort"):
            params.pop(key, None)

        qs = discover(None, params)
        if isinstance(qs, list):
            total = len(qs)
            page = qs[offset : offset + limit]
        else:
            total = qs.count()
            page = list(qs[offset : offset + limit])

        return Response(
            {
                "items": [_org_summary(org) for org in page],
                "total": total,
                "offset": offset,
                "limit": limit,
            }
        )
