from django.db import connection, transaction
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

        # This path is exempt from RLSViewerMiddleware (orgs/middleware.py) as a
        # perf win, since the response body itself doesn't need `beedero.viewer_id`
        # — but `public_person_profile()` also reads `viewer_actions`
        # (connection_status/can_message), which query RLS-protected tables. Set
        # the GUC ourselves, scoped to just this request, whenever there's a real
        # viewer to check against.
        if viewer is not None and connection.vendor == "postgresql":
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL beedero.viewer_id = %s", [viewer.id])
                return Response(public_person_profile(handle, viewer))

        return Response(public_person_profile(handle, viewer))
