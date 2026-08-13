from django.db.models import Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from connections.models import Connection, ConnectionRequest
from connections.serializers import user_summary
from connections.services import remove_connection
from orgs.models import OrgFollow


def _org_summary(org):
    logo = None
    if org.logo:
        try:
            logo = org.logo.url
        except ValueError:
            logo = None
    return {"slug": org.slug, "name": org.name, "logo": logo}


class NetworkConnectionsView(APIView):
    """GET /api/network/connections/?q= — the viewer's established
    connections, searchable by the other party's name/handle."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        connections = (
            Connection.objects.filter(Q(user_one=request.user) | Q(user_two=request.user))
            .select_related("user_one__investorprofile", "user_two__investorprofile")
            .order_by("-created_at")
        )
        q = request.query_params.get("q", "").strip().lower()
        items = []
        for connection in connections:
            other = connection.user_two if connection.user_one_id == request.user.id else connection.user_one
            summary = user_summary(other)
            if q and q not in summary["name"].lower() and q not in (summary["handle"] or "").lower():
                continue
            items.append(
                {
                    "connection_id": connection.id,
                    "user": summary,
                    "created_at": connection.created_at.isoformat(),
                }
            )
        return Response({"items": items})


class NetworkConnectionDetailView(APIView):
    """DELETE /api/network/connections/<id>/ — remove a connection. Either
    party can remove it; silent, no notification (spec: "discreto e sem
    drama")."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, connection_id):
        remove_connection(request.user, connection_id)
        return Response(status=204)


class NetworkFollowingView(APIView):
    """GET /api/network/following/ — organizations the viewer follows.
    People are connected with, not followed — see NetworkConnectionsView."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = [
            {
                "type": "org",
                "id": follow.org.slug,
                "target": _org_summary(follow.org),
                "created_at": follow.created_at.isoformat(),
            }
            for follow in OrgFollow.objects.filter(user=request.user)
            .select_related("org")
            .order_by("-created_at")
        ]
        return Response({"items": items})


class NetworkCountsView(APIView):
    """GET /api/network/counts/ — badge/sidebar counters."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "connections": Connection.objects.filter(Q(user_one=user) | Q(user_two=user)).count(),
                "pending": ConnectionRequest.objects.filter(
                    recipient=user, status=ConnectionRequest.Status.PENDING
                ).count(),
                "following": OrgFollow.objects.filter(user=user).count(),
            }
        )
