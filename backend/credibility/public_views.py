"""Public badge + verify endpoints — no auth, public data only."""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Organization

from .badge import badge_state, render_badge_svg


class PublicBadgeSvgView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, slug):
        org = get_object_or_404(Organization, slug=slug, status=Organization.Status.LIVE)
        svg = render_badge_svg(badge_state(org))
        response = HttpResponse(svg, content_type="image/svg+xml")
        response["Cache-Control"] = "public, max-age=3600"
        return response


class PublicBadgeJsonView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, slug):
        org = get_object_or_404(Organization, slug=slug, status=Organization.Status.LIVE)
        return Response(badge_state(org))


class PublicVerifyView(APIView):
    """Public verification page data — layers + dates only, never restricted fields."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, slug):
        org = get_object_or_404(Organization, slug=slug, status=Organization.Status.LIVE)
        state = badge_state(org)
        return Response(
            {
                "org": {
                    "slug": org.slug,
                    "name": org.name,
                    "one_liner": org.one_liner,
                    "logo": org.logo.url if org.logo else None,
                },
                "badge": state,
            }
        )
