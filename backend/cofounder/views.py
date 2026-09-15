"""Doc §8. One deviation from the spec's endpoint list: there is no
/api/cofounder/matches/<id>/messages/ — the post-match chat is the ordinary
DM thread, so the client follows `conversation_id` into /api/conversations/.
That reuses block, report, unread counts and the inbox instead of growing a
second, weaker messaging stack (see CofounderMatch's docstring).
"""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from . import services
from .models import BuilderProfile
from .recommendations import DAILY_LIMIT, daily_deck, invalidate_deck
from .serializers import (
    BuilderProfileSerializer,
    CreateOrgSerializer,
    InterestSerializer,
    OutcomeSerializer,
    builder_card,
    match_summary,
)


class BuilderProfileView(APIView):
    """GET/PUT/PATCH /api/cofounder/profile/ — the opt-in facet itself."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = services.get_or_create_profile(request.user)
        return Response(BuilderProfileSerializer(profile).data)

    def put(self, request):
        return self._save(request)

    def patch(self, request):
        return self._save(request)

    def _save(self, request):
        profile = services.get_or_create_profile(request.user)
        was_active = profile.is_active
        serializer = BuilderProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        candidate = BuilderProfile(**{**_as_dict(profile), **serializer.validated_data})
        if candidate.is_active:
            # Raises before anything is written, so a rejected opt-in leaves
            # the profile exactly as it was.
            services.activate_profile(candidate)
        serializer.save()
        profile.refresh_from_db()

        # Anything about me that changed changes who should see me and who I
        # should see, so today's deck is no longer the right deck.
        invalidate_deck(request.user)
        if was_active != profile.is_active:
            services.bust_density_cache(request.user)
        return Response(BuilderProfileSerializer(profile).data)


def _as_dict(profile: BuilderProfile) -> dict:
    return {
        field: getattr(profile, field)
        for field in (
            "is_active",
            "adult_confirmed",
            "primary_strength",
            "looking_for",
            "commitment",
            "sectors",
            "has_idea",
            "idea_pitch",
            "prompts",
        )
    }


class DeckView(APIView):
    """GET /api/cofounder/deck/ — today's ten, stable within the day."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = services.get_or_create_profile(request.user)
        if not profile.is_active:
            return Response(
                {
                    "active": False,
                    "daily_limit": DAILY_LIMIT,
                    "cards": [],
                    "detail": "Turn on co-founder matching to see builders.",
                }
            )
        cards = [builder_card(builder) for builder in daily_deck(request.user)]
        return Response({"active": True, "daily_limit": DAILY_LIMIT, "cards": cards})


class InterestView(APIView):
    """POST /api/cofounder/interest/ — "Interested" or "Pass"."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InterestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = get_object_or_404(User, pk=serializer.validated_data["target_id"])
        _, match = services.record_interest(
            request.user, target, serializer.validated_data["liked"]
        )
        return Response(
            {
                "matched": match is not None,
                "match": match_summary(match, request.user) if match else None,
            },
            status=status.HTTP_201_CREATED,
        )


class MatchListView(APIView):
    """GET /api/cofounder/matches/"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        matches = services.matches_for(request.user)
        return Response({"results": [match_summary(m, request.user) for m in matches]})


class MatchOutcomeView(APIView):
    """POST /api/cofounder/matches/<id>/outcome/ — met, chatting, archived."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        match = services.get_match_or_404(request.user, pk)
        serializer = OutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        match = services.set_outcome(match, serializer.validated_data["outcome"])
        return Response(match_summary(match, request.user))


class MatchCreateOrgView(APIView):
    """POST /api/cofounder/matches/<id>/create-org/ — the mother metric."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        match = services.get_match_or_404(request.user, pk)
        serializer = CreateOrgSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org, invite = services.create_org_from_match(
            match,
            request.user,
            serializer.validated_data["name"],
            serializer.validated_data.get("one_liner", ""),
        )
        match.refresh_from_db()
        return Response(
            {
                "org": {"slug": org.slug, "name": org.name},
                "invite_token": str(invite.token),
                "match": match_summary(match, request.user),
            },
            status=status.HTTP_201_CREATED,
        )


class StatusView(APIView):
    """GET /api/cofounder/status/ — is the module worth surfacing to this
    person yet (doc §10), and have they opted in? The frontend nav reads this;
    the gate hides promotion, never access."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "builder", None)
        density = services.density_status(request.user)
        return Response(
            {
                **density,
                "is_active": bool(profile and profile.is_active),
                "is_complete": bool(profile and profile.is_complete),
                # Promote it to people already in, regardless of density —
                # hiding the entry point from someone with live matches would
                # be a bug, not restraint.
                "show_entry_point": density["gate_met"] or bool(profile and profile.is_active),
            }
        )
