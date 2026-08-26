from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import ActivityFeedImpression, PersonProfileView
from connections.models import Connection
from orgs.models import Activity, Visibility
from orgs.services import create_activity, sole_owner_orgs
from social.mentions import resolve_mentions
from social.models import Reaction
from social.services import reaction_counts_for

from .badge import person_badge_embed_html
from .handles import ensure_profile_handle
from .models import InvestorProfile, SelfDeclaredExperience
from .serializers import (
    InvestorPostSerializer,
    InvestorProfileSerializer,
    MeSerializer,
    SelfDeclaredExperienceSerializer,
)
from .vitality import person_vitality_state


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def delete(self, request):
        """Deletes the caller's account. Orgs the caller solely owns are
        deleted with it; orgs with other owners just lose this membership
        (cascades automatically via OrgMembership.user's on_delete=CASCADE)."""
        user = request.user
        with transaction.atomic():
            sole_owner_orgs(user).delete()
            user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


INVESTOR_POST_KIND_MAP = {"milestone": "milestones", "event": "events", "update": "update"}


def _investor_activity_summary(activity, reaction_counts=None):
    counts = reaction_counts or {"like": 0, "insight": 0, "congrats": 0}
    return {
        "id": activity.id,
        "kind": activity.kind,
        "title": activity.title,
        "body": activity.body,
        "mentions": resolve_mentions(activity.body),
        "image": activity.image.url if activity.image else None,
        "occurred_at": activity.occurred_at.isoformat(),
        "ends_at": activity.ends_at.isoformat() if activity.ends_at else None,
        "created_at": activity.created_at.isoformat(),
        "author_name": _investor_display_name(activity.author),
        "reaction_count": activity.reaction_count,
        "reaction_counts": counts,
        "feed_impression_count": activity.feed_impression_count,
    }


def _investor_activity_summaries(activities):
    activity_list = list(activities)
    reaction_counts = reaction_counts_for([a.id for a in activity_list])
    return [
        _investor_activity_summary(a, reaction_counts.get(a.id)) for a in activity_list
    ]


def _investor_display_name(user):
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or user.email


class InvestorPostListCreateView(APIView):
    """A verified investor's personal milestone/event/update posts, shown to
    their followers' feed (§Feed people). Persisted as an orgs.Activity —
    kept as a thin wrapper (plan §0) rather than merged with FeedPostView."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        activities = Activity.objects.filter(author=request.user, org__isnull=True).order_by(
            "-occurred_at"
        )
        return Response(_investor_activity_summaries(activities))

    def post(self, request):
        if Activity.objects.filter(
            author=request.user, org__isnull=True, created_at__date=timezone.localdate()
        ).exists():
            raise ValidationError({"detail": "This profile has already shared a post today."})
        serializer = InvestorPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        activity = create_activity(
            author=request.user,
            kind=INVESTOR_POST_KIND_MAP[data["kind"]],
            title=data["title"],
            body=data.get("body", ""),
            occurred_at=data["occurred_at"],
            ends_at=data.get("ends_at"),
            image=data.get("image"),
            visibility=Visibility.PUBLIC,
        )
        return Response(_investor_activity_summary(activity), status=201)


INVESTOR_STATS_RANGES = {"7d": 7, "30d": 30, "90d": 90}


def _investor_stats_range_days(request) -> int:
    raw = request.query_params.get("range", "7d")
    return INVESTOR_STATS_RANGES.get(raw, 7)


class InvestorStatsView(APIView):
    """Personal profile KPIs for the authenticated investor."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        days = _investor_stats_range_days(request)
        since = timezone.now() - timedelta(days=days)

        connections_count = Connection.objects.filter(Q(user_one=user) | Q(user_two=user)).count()
        new_connections = Connection.objects.filter(
            Q(user_one=user) | Q(user_two=user), created_at__gte=since
        ).count()

        personal_posts = Activity.objects.filter(author=user, org__isnull=True)
        posts_count = personal_posts.filter(created_at__gte=since).count()
        reactions_received = Reaction.objects.filter(
            activity__in=personal_posts, created_at__gte=since
        ).count()
        # Windowed to `since`, unlike `reactions_received`/`posts_count` above
        # (lifetime totals) — Activity.feed_impression_count is itself a
        # lifetime counter (analytics.services.record_feed_impressions
        # increments it forever), so it can't answer "in the last N days" on
        # its own; ActivityFeedImpression rows are timestamped per first-view
        # and give us that window directly.
        post_impressions_count = ActivityFeedImpression.objects.filter(
            activity__in=personal_posts, viewed_at__gte=since
        ).count()
        profile_views_count = PersonProfileView.objects.filter(subject=user, viewed_at__gte=since).count()

        return Response(
            {
                "connections_count": connections_count,
                "range_days": days,
                "new_connections": new_connections,
                "posts_count": posts_count,
                "reactions_received": reactions_received,
                "post_impressions_count": post_impressions_count,
                "profile_views_count": profile_views_count,
            }
        )


def _get_investor_profile(user):
    profile, _ = InvestorProfile.objects.get_or_create(user=user)
    if profile.full_name:
        ensure_profile_handle(profile)
        profile.refresh_from_db()
    return profile


class InvestorVitalityView(APIView):
    """GET /api/investors/me/vitality/ — private checklist + presence."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _get_investor_profile(request.user)
        return Response(person_vitality_state(profile))


class InvestorBadgeEmbedView(APIView):
    """GET /api/investors/me/badge-embed/ — copy-paste snippet for external sites."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _get_investor_profile(request.user)
        return Response(person_badge_embed_html(profile))


class InvestorProfileView(APIView):
    """Creation/editing of one's own investor profile. Verification
    (is_verified) is manual at launch — only the verify_investor
    management command can turn it on (§8 item 3)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _get_investor_profile(request.user)
        return Response(InvestorProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        serializer = InvestorProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        ensure_profile_handle(profile)
        profile.refresh_from_db()
        return Response(InvestorProfileSerializer(profile).data)


class SelfDeclaredExperienceListCreateView(APIView):
    """A person's self-declared, unverified past affiliations — free-text
    org name, shown as a dashed band on the timeline (accounts/timeline.py)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        experiences = SelfDeclaredExperience.objects.filter(user=request.user)
        return Response(SelfDeclaredExperienceSerializer(experiences, many=True).data)

    def post(self, request):
        serializer = SelfDeclaredExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)


class SelfDeclaredExperienceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, experience_id):
        experience = get_object_or_404(SelfDeclaredExperience, id=experience_id, user=request.user)
        serializer = SelfDeclaredExperienceSerializer(experience, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, experience_id):
        experience = get_object_or_404(SelfDeclaredExperience, id=experience_id, user=request.user)
        experience.delete()
        return Response(status=204)
