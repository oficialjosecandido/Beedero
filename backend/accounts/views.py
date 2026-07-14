from django.utils import timezone
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Activity, Visibility
from orgs.services import create_activity

from .models import InvestorProfile
from .serializers import InvestorPostSerializer, InvestorProfileSerializer, MeSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


INVESTOR_POST_KIND_MAP = {"milestone": "milestones", "event": "events", "update": "update"}


def _investor_activity_summary(activity):
    return {
        "id": activity.id,
        "kind": activity.kind,
        "title": activity.title,
        "body": activity.body,
        "image": activity.image.url if activity.image else None,
        "occurred_at": activity.occurred_at.isoformat(),
        "created_at": activity.created_at.isoformat(),
        "author_name": _investor_display_name(activity.author),
    }


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
        return Response([_investor_activity_summary(a) for a in activities])

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
            image=data.get("image"),
            visibility=Visibility.PUBLIC,
        )
        return Response(_investor_activity_summary(activity), status=201)


class InvestorProfileView(APIView):
    """Creation/editing of one's own investor profile. Verification
    (is_verified) is manual at launch — only the verify_investor
    management command can turn it on (§8 item 3)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        return Response(InvestorProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        serializer = InvestorProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
