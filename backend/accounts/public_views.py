from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .badge import person_badge_state, render_person_badge_svg
from .models import InvestorProfile
from .public import public_person_profile


class PublicPersonBadgeSvgView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, handle):
        profile = get_object_or_404(InvestorProfile, handle=handle)
        svg = render_person_badge_svg(person_badge_state(profile))
        response = HttpResponse(svg, content_type="image/svg+xml")
        response["Cache-Control"] = "public, max-age=3600"
        return response


class PublicPersonBadgeJsonView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, handle):
        profile = get_object_or_404(InvestorProfile, handle=handle)
        return Response(person_badge_state(profile))


class PublicPersonProfileView(APIView):
    """GET /api/public/people/<handle>/ — public profile with visibility applied."""

    permission_classes = []

    def get(self, request, handle):
        viewer = request.user if request.user.is_authenticated else None
        return Response(public_person_profile(handle, viewer))
