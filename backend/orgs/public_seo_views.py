"""Public SEO endpoints — sitemap data and unauthenticated discovery."""

from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import InvestorProfile

from .discovery import discover
from .models import Organization
from .serializers import _org_summary


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
        orgs = Organization.objects.filter(status=Organization.Status.LIVE).order_by("slug")
        org_entries = [
            {"slug": org.slug, "lastmod": org.created_at.date().isoformat()} for org in orgs
        ]

        people_qs = (
            InvestorProfile.objects.filter(handle__isnull=False)
            .exclude(handle="")
            .exclude(full_name="")
            .exclude(headline="")
            .exclude(country="")
            .select_related("user")
            .order_by("handle")
        )
        people_entries = [
            {
                "handle": profile.handle,
                "lastmod": profile.user.date_joined.date().isoformat(),
            }
            for profile in people_qs
        ]

        verify_entries = [
            {"slug": org.slug, "lastmod": org.created_at.date().isoformat()}
            for org in orgs.filter(is_verified=True)
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
