from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Organization
from orgs.permissions import IsOrgOwnerOrAdmin, OrgLookupMixin

from .models import Affiliation
from .serializers import AffiliationAddSerializer, AffiliationDeclareSerializer, affiliation_summary
from .services import (
    accept_affiliation,
    confirm_affiliation,
    declare_affiliation,
    dispute_affiliation,
    org_add_affiliation,
    withdraw_affiliation,
)

User = get_user_model()


class AffiliationListCreateView(APIView):
    """POST /api/affiliations/ — self-declare; GET is served by AffiliationMineView."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AffiliationDeclareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        org = get_object_or_404(Organization, slug=data.pop("org_slug"))
        try:
            affiliation = declare_affiliation(request.user, org, **data)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation), status=status.HTTP_201_CREATED)


class AffiliationMineView(APIView):
    """GET /api/affiliations/mine/ — the person's own affiliations, every status."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        affiliations = Affiliation.objects.filter(user=request.user).select_related("org", "user")
        return Response({"items": [affiliation_summary(a) for a in affiliations]})


class AffiliationDetailView(APIView):
    """DELETE /api/affiliations/<id>/ — withdraw; owner-only."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, affiliation_id):
        affiliation = get_object_or_404(Affiliation, pk=affiliation_id)
        try:
            withdraw_affiliation(affiliation, request.user)
        except PermissionDenied:
            return Response({"detail": "Not found."}, status=404)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AffiliationAcceptView(APIView):
    """POST /api/affiliations/<id>/accept/ — person accepts an org-added row."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, affiliation_id):
        affiliation = get_object_or_404(Affiliation, pk=affiliation_id)
        try:
            affiliation = accept_affiliation(affiliation, request.user)
        except PermissionDenied:
            return Response({"detail": "Not found."}, status=404)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation))


class OrgAffiliationsListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/affiliations/ — owner/admin sees every status
    (Team tab), creating adds a member for the target person to accept."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        affiliations = org.affiliations.select_related("org", "user")
        return Response({"items": [affiliation_summary(a) for a in affiliations]})

    def post(self, request, slug):
        org = self.get_org()
        serializer = AffiliationAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        target_user = get_object_or_404(User, investorprofile__handle=data.pop("handle"))
        try:
            affiliation = org_add_affiliation(request.user, org, target_user, **data)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation), status=status.HTTP_201_CREATED)


class OrgAffiliationsPendingView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/affiliations/pending/ — actionable queue: pending,
    person-initiated declarations awaiting confirm/dispute."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        affiliations = org.affiliations.filter(
            status=Affiliation.Status.PENDING
        ).select_related("org", "user")
        affiliations = [a for a in affiliations if a.created_by_id == a.user_id]
        return Response({"items": [affiliation_summary(a) for a in affiliations]})


class OrgAffiliationConfirmView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/affiliations/<id>/confirm/"""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug, affiliation_id):
        org = self.get_org()
        affiliation = get_object_or_404(Affiliation, pk=affiliation_id, org=org)
        try:
            affiliation = confirm_affiliation(affiliation, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation))


class OrgAffiliationDisputeView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/affiliations/<id>/dispute/"""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug, affiliation_id):
        org = self.get_org()
        affiliation = get_object_or_404(Affiliation, pk=affiliation_id, org=org)
        try:
            affiliation = dispute_affiliation(affiliation, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation))
