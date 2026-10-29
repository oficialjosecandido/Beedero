"""Public newsletter endpoints. Composing and sending lives in the Nexus
(nexus/newsletter.py); the old /admin/newsletter/ page redirects there."""

from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.admin_access import kpi_admin_required

from .sending import unsubscribe


class UnsubscribeView(APIView):
    """POST, no account needed — the signed token is the only credential.

    Two callers: the /unsubscribe page (the link in the email) and mail apps
    using one-click unsubscribe (RFC 8058), which POST to the List-Unsubscribe
    URL with the token in the query string."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.query_params.get("token") or request.data.get("token", "")
        delivery = unsubscribe(token)
        return Response({"unsubscribed": True, "email": delivery.email})


@kpi_admin_required
def newsletter_moved(request, *args, **kwargs):
    """The old Django-admin page sent to every account without asking for
    consent. Its job moved to the Nexus, which only sends the newsletter to
    people who opted in."""
    return HttpResponseRedirect(f"{settings.FRONTEND_URL.rstrip('/')}/beedero-nexus/newsletter")
