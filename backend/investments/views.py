from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import FundraiseRound, Organization
from orgs.permissions import IsOrgMember, OrgLookupMixin

from .models import InvestmentRecord
from .serializers import (
    InvestmentConfirmSerializer,
    InvestorDeclareSerializer,
    StartupDeclareSerializer,
    investment_summary,
)
from .services import (
    confirm_investment,
    declare_investment_as_investor,
    declare_investment_as_startup,
    dispute_investment,
    investor_portfolio,
    round_progress,
)

User = get_user_model()


class InvestmentListCreateView(APIView):
    """POST /api/investments/ — investor declares; GET is InvestmentMineView."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InvestorDeclareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        org = get_object_or_404(Organization, slug=data.pop("org_slug"))
        round_id = data.pop("round")
        round_ = get_object_or_404(FundraiseRound, pk=round_id, org=org) if round_id else None
        try:
            record = declare_investment_as_investor(request.user, org, round=round_, **data)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(investment_summary(record), status=status.HTTP_201_CREATED)


class InvestmentMineView(APIView):
    """GET /api/investments/mine/ — the investor's own records, every status."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        records = InvestmentRecord.objects.filter(investor_user=request.user).select_related("org")
        return Response({"items": [investment_summary(r) for r in records]})


class InvestmentConfirmView(APIView):
    """POST /api/investments/<id>/confirm/ — the counterparty confirms."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, investment_id):
        record = get_object_or_404(InvestmentRecord, pk=investment_id)
        serializer = InvestmentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            record = confirm_investment(record, request.user, **serializer.validated_data)
        except PermissionDenied:
            return Response({"detail": "Not found."}, status=404)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(investment_summary(record))


class InvestmentDisputeView(APIView):
    """POST /api/investments/<id>/dispute/ — the counterparty disputes."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, investment_id):
        record = get_object_or_404(InvestmentRecord, pk=investment_id)
        try:
            record = dispute_investment(record, request.user)
        except PermissionDenied:
            return Response({"detail": "Not found."}, status=404)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(investment_summary(record))


class OrgInvestmentsListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/investments/ — any member sees the org's
    records and can declare on the startup's behalf."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        records = org.investments_received.select_related("org", "investor_user")
        return Response({"items": [investment_summary(r) for r in records]})

    def post(self, request, slug):
        org = self.get_org()
        serializer = StartupDeclareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        handle = data.pop("handle")
        investor_user = (
            get_object_or_404(User, investorprofile__handle=handle) if handle else None
        )
        round_id = data.pop("round")
        round_ = get_object_or_404(FundraiseRound, pk=round_id, org=org) if round_id else None
        try:
            record = declare_investment_as_startup(
                request.user, org, investor_user=investor_user, round=round_, **data
            )
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(investment_summary(record), status=status.HTTP_201_CREATED)


class RoundProgressView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/rounds/<round_id>/progress/ — confirmed vs.
    declared totals for the round, dashboard-only (doc §4)."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug, round_id):
        org = self.get_org()
        round_ = get_object_or_404(FundraiseRound, pk=round_id, org=org)
        return Response(round_progress(org, round_))


class InvestorPortfolioView(APIView):
    """GET /api/users/<handle>/portfolio/ — public, confirmed + consented
    investments only."""

    permission_classes = []

    def get(self, request, handle):
        return Response({"items": investor_portfolio(handle)})
