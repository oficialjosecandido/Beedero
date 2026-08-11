from django.contrib.auth import get_user_model
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.permissions import IsOrgOwnerOrAdmin, OrgLookupMixin

from .models import ConnectionRequest, OrgConnectionRequest
from .serializers import (
    SendConnectionRequestSerializer,
    SendOrgConnectionRequestSerializer,
    SendOrgOutreachSerializer,
    connection_request_summary,
    org_connection_request_summary,
)
from .services import (
    accept_org_request,
    accept_request,
    can_org_admin_accept,
    credibility_weight,
    decline_org_request,
    decline_request,
    send_org_outreach,
    send_org_request,
    send_request,
)

User = get_user_model()


def _pending_sort_key(req):
    """Verified/high-tier requesters with a note surface first."""
    return (0 if req.note else 1, credibility_weight(req.requester), -req.created_at.timestamp())


class ConnectionRequestCreateView(APIView):
    """POST /api/connections/requests/ — send a connection request with an
    optional note. Never opens a conversation on its own."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SendConnectionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipient = get_object_or_404(User, pk=serializer.validated_data["recipient_id"])
        req = send_request(request.user, recipient, serializer.validated_data["note"])
        return Response(connection_request_summary(req), status=201)


class PendingConnectionRequestListView(APIView):
    """GET /api/connections/requests/pending/ — requests waiting on the
    viewer's decision."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pending = list(
            ConnectionRequest.objects.filter(
                recipient=request.user, status=ConnectionRequest.Status.PENDING
            ).select_related("requester__investorprofile")
        )
        pending.sort(key=_pending_sort_key)
        return Response({"items": [connection_request_summary(r) for r in pending]})


class ConnectionRequestAcceptView(APIView):
    """POST /api/connections/requests/<id>/accept/ — creates the connection
    and, if the request had a note, opens the conversation with it."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        req = get_object_or_404(ConnectionRequest, pk=request_id)
        if request.user.id not in (req.requester_id, req.recipient_id):
            raise Http404
        connection, conversation = accept_request(req, request.user)
        return Response(
            {
                "connection": {"id": connection.id},
                "conversation": {"id": conversation.id} if conversation else None,
            }
        )


class ConnectionRequestDeclineView(APIView):
    """POST /api/connections/requests/<id>/decline/ — silent, no
    notification to the requester."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        req = get_object_or_404(ConnectionRequest, pk=request_id)
        if request.user.id not in (req.requester_id, req.recipient_id):
            raise Http404
        decline_request(req, request.user)
        return Response(status=204)


class OrgConnectionRequestCreateView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/connections/requests/ — person -> org."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        org = self.get_org()
        serializer = SendOrgConnectionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = send_org_request(request.user, org, serializer.validated_data["note"])
        return Response(org_connection_request_summary(req), status=201)


class OrgConnectionRequestPendingListView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/connections/requests/pending/ — org admins only."""

    permission_classes = [IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        pending = list(
            OrgConnectionRequest.objects.filter(
                org=org,
                status=OrgConnectionRequest.Status.PENDING,
                initiated_by=OrgConnectionRequest.InitiatedBy.USER,
            ).select_related("requester__investorprofile")
        )
        pending.sort(key=_pending_sort_key)
        return Response({"items": [org_connection_request_summary(r) for r in pending]})


class OrgConnectionRequestAcceptView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/connections/requests/<id>/accept/ — an org
    admin accepting a person's request, or the person accepting an org's
    outreach; connections.services.accept_org_request enforces which."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, request_id):
        org = self.get_org()
        req = get_object_or_404(OrgConnectionRequest, pk=request_id, org=org)
        if not (req.requester_id == request.user.id or can_org_admin_accept(org, request.user)):
            raise Http404
        conversation = accept_org_request(req, request.user)
        return Response({"conversation": {"id": conversation.id} if conversation else None})


class OrgConnectionRequestDeclineView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/connections/requests/<id>/decline/."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, request_id):
        org = self.get_org()
        req = get_object_or_404(OrgConnectionRequest, pk=request_id, org=org)
        if not (req.requester_id == request.user.id or can_org_admin_accept(org, request.user)):
            raise Http404
        decline_org_request(req, request.user)
        return Response(status=204)


class OrgOutreachCreateView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/connections/outreach/ — org -> person, admin
    only. No frontend entry point for this direction yet (scope cut)."""

    permission_classes = [IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        serializer = SendOrgOutreachSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipient = get_object_or_404(User, pk=serializer.validated_data["recipient_id"])
        req = send_org_outreach(org, request.user, recipient, serializer.validated_data["note"])
        return Response(org_connection_request_summary(req), status=201)
