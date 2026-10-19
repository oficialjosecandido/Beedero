from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Organization
from orgs.permissions import IsOrgOwnerOrAdmin, OrgLookupMixin

from .models import Affiliation, TeamInvite
from .serializers import (
    AffiliationAddSerializer,
    AffiliationDeclareSerializer,
    TeamInviteCreateSerializer,
    TeamInviteDeclineSerializer,
    TeamInviteReportSerializer,
    affiliation_summary,
    team_invite_public,
    team_invite_summary,
)
from .services import (
    accept_affiliation,
    confirm_affiliation,
    declare_affiliation,
    dispute_affiliation,
    org_add_affiliation,
    update_affiliation,
    withdraw_affiliation,
)
from .team_invites import (
    OptedOut,
    accept_team_invite,
    decline_team_invite,
    invite_quota,
    invite_team_member,
    report_team_invite,
)
from .throttles import TeamInviteTokenThrottle

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
    """PATCH / DELETE /api/affiliations/<id>/ — owner-only."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, affiliation_id):
        from beedero.date_bounds import assert_date_in_bounds
        from django.utils.dateparse import parse_date

        affiliation = get_object_or_404(Affiliation, pk=affiliation_id)
        title = str(request.data.get("title", affiliation.title) or "").strip()
        started_on = parse_date(str(request.data.get("started_on", affiliation.started_on.isoformat()) or ""))
        if not started_on:
            return Response({"started_on": "Invalid start date."}, status=400)
        try:
            assert_date_in_bounds(started_on)
        except Exception as exc:
            detail = getattr(exc, "detail", None) or str(exc)
            return Response({"started_on": detail}, status=400)
        raw_ended = request.data.get("ended_on", affiliation.ended_on)
        if raw_ended in (None, ""):
            ended_on = None
        else:
            ended_on = parse_date(str(raw_ended))
            if not ended_on:
                return Response({"ended_on": "Invalid end date."}, status=400)
            try:
                assert_date_in_bounds(ended_on)
            except Exception as exc:
                detail = getattr(exc, "detail", None) or str(exc)
                return Response({"ended_on": detail}, status=400)
        skills = request.data.get("skills", affiliation.skills)
        try:
            affiliation = update_affiliation(
                affiliation,
                request.user,
                title=title,
                started_on=started_on,
                ended_on=ended_on,
                skills=skills if isinstance(skills, list) else affiliation.skills,
            )
        except PermissionDenied:
            return Response({"detail": "Not found."}, status=404)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation))

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


class OrgTeamInvitesView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/team-invites/ — the org's own invite list.

    Owner/admin only (§2.4: "Só admins da org enviam convites"), which the
    permission class enforces for both methods.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        invites = org.team_invites.order_by("-created_at")
        return Response(
            {
                "items": [team_invite_summary(i) for i in invites],
                "quota": invite_quota(org),
            }
        )

    def post(self, request, slug):
        org = self.get_org()
        serializer = TeamInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            kind, obj = invite_team_member(request.user, org, **serializer.validated_data)
        except OptedOut:
            # An opt-out must not be reportable. Answering "invited" to an org
            # that just tried to email someone who blocked them is the only
            # answer that doesn't turn the opt-out into a disclosure — and no
            # email is sent either way, which is what the opt-out asked for.
            return Response({"kind": "invite", "item": None}, status=status.HTTP_201_CREATED)
        except ValidationError as exc:
            return Response(exc.detail, status=400)

        if kind == "affiliation":
            # Already a member of Beedero: no email from us, just the in-app
            # accept flow that already exists (§2.2 step 2).
            return Response(
                {"kind": "affiliation", "item": affiliation_summary(obj)},
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"kind": "invite", "item": team_invite_summary(obj)},
            status=status.HTTP_201_CREATED,
        )


class PublicTeamInviteView(APIView):
    """GET /api/public/team-invites/<token>/ — what the link shows.

    Unauthenticated by necessity: the person it was sent to has no account yet,
    and §2.2 has them reading this before deciding whether to make one. Under
    `/api/public/` so the RLS middleware leaves it alone, like the other
    endpoints a visitor can reach.

    The token is the only credential, so the payload is built for a reader who
    might not be the intended one: see `team_invite_public`.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [TeamInviteTokenThrottle]

    def get(self, request, token):
        invite = get_object_or_404(
            TeamInvite.objects.select_related("org", "invited_by"), token=token
        )
        return Response(team_invite_public(invite))


class PublicTeamInviteDeclineView(APIView):
    """POST /api/public/team-invites/<token>/decline/ — no, and optionally never.

    No session required, on purpose. §2.4 wants a decline link in the email,
    and making someone create an account in order to refuse an invitation
    would be the exact inverse of consent. The token in their inbox is the
    authorisation; nothing here reveals anything a holder of the link can't
    already see, and the only state it can reach is this one invite.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [TeamInviteTokenThrottle]

    def post(self, request, token):
        invite = get_object_or_404(TeamInvite.objects.select_related("org"), token=token)
        serializer = TeamInviteDeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decline_team_invite(invite, block=serializer.validated_data["block"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicTeamInviteReportView(APIView):
    """POST /api/public/team-invites/<token>/report/ — "this shouldn't have come to me".

    Session-free for the same reason declining is: the complaint is about having
    been emailed without an account, so requiring an account to complain would
    make the complaint unreachable by exactly the people entitled to make it.

    Always answers 204, including on an invite that was already declined or has
    expired. Someone opening the email late still gets to object, and the reply
    says nothing about what state the invite was in — a report that answered
    differently depending on the invite would be a probe.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [TeamInviteTokenThrottle]

    def post(self, request, token):
        invite = get_object_or_404(TeamInvite.objects.select_related("org"), token=token)
        serializer = TeamInviteReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report_team_invite(invite, **serializer.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamInviteAcceptView(APIView):
    """POST /api/team-invites/<token>/accept/ — the person says yes.

    Authenticated, unlike declining: accepting writes a verified fact onto
    somebody's profile, so it needs to be somebody, and the address has to
    match the one the org named.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        invite = get_object_or_404(TeamInvite.objects.select_related("org"), token=token)
        try:
            affiliation = accept_team_invite(invite, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(affiliation_summary(affiliation), status=status.HTTP_201_CREATED)
