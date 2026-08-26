from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.pagination import decode_cursor, encode_cursor
from beedero.ratelimit import enforce_rate_limit
from orgs.models import Activity
from orgs.visibility import activity_visible_to

from .mentions import search_mentionable
from .models import Comment
from .serializers import CommentCreateSerializer, ReactionSerializer, comment_summary
from .services import (
    create_comment,
    get_visible_activity_or_404,
    reaction_counts_for,
    remove_event_participation,
    remove_reaction,
    set_event_participation,
    toggle_reaction,
    user_has_commented,
)
from .unfurl import get_or_fetch_preview

REACTIONS_PER_DAY = 200
COMMENTS_PER_DAY = 30
LINK_PREVIEWS_PER_HOUR = 60


class ActivityReactionView(APIView):
    """POST/DELETE /api/activities/<id>/reactions/ — idempotent toggle. A
    second POST with a different kind updates in place (services.toggle_reaction)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        enforce_rate_limit(f"react:{request.user.id}", limit=REACTIONS_PER_DAY, window_seconds=86400)

        serializer = ReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        toggle_reaction(activity, request.user, serializer.validated_data["kind"])

        activity.refresh_from_db(fields=["reaction_count"])
        from notifications.services import notify_activity_reaction

        notify_activity_reaction(activity, request.user, activity.reaction_count)
        return Response(
            {
                "reaction_count": activity.reaction_count,
                "reaction_counts": reaction_counts_for([activity.id])[activity.id],
            }
        )

    def delete(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        remove_reaction(activity, request.user)
        activity.refresh_from_db(fields=["reaction_count"])
        return Response(
            {
                "reaction_count": activity.reaction_count,
                "reaction_counts": reaction_counts_for([activity.id])[activity.id],
            }
        )


class ActivityCommentListCreateView(APIView):
    """GET (keyset paginated, newest first) / POST /api/activities/<id>/comments/"""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 20
    MAX_LIMIT = 50

    def get(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)

        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit."}, status=400)
        limit = max(1, min(limit, self.MAX_LIMIT))

        cursor = None
        cursor_raw = request.query_params.get("cursor")
        if cursor_raw:
            cursor = decode_cursor(cursor_raw)
            if cursor is None:
                return Response({"detail": "Invalid cursor."}, status=400)

        qs = (
            Comment.objects.filter(activity=activity, deleted_at__isnull=True, parent__isnull=True)
            .select_related("author", "author__investorprofile", "activity")
            .order_by("-created_at", "-id")
        )
        if cursor is not None:
            created_at, item_id = cursor
            qs = qs.filter(Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=int(item_id)))

        comments = list(qs[: limit + 1])
        next_cursor = None
        if len(comments) > limit:
            last = comments[limit - 1]
            next_cursor = encode_cursor(last.created_at, last.id)
            comments = comments[:limit]

        return Response(
            {
                "items": [comment_summary(c) for c in comments],
                "next_cursor": next_cursor,
                "viewer_has_commented": user_has_commented(activity, request.user),
            }
        )

    def post(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        enforce_rate_limit(f"comment:{request.user.id}", limit=COMMENTS_PER_DAY, window_seconds=86400)

        if user_has_commented(activity, request.user):
            raise ValidationError({"detail": "You have already commented on this post."})

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = create_comment(activity, request.user, serializer.validated_data["body"])
        activity.refresh_from_db(fields=["comment_count"])
        from notifications.services import notify_activity_comment

        notify_activity_comment(activity, request.user, activity.comment_count)
        return Response(comment_summary(comment), status=201)


class CommentDeleteView(APIView):
    """Comments are permanent — deletion is not allowed."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, comment_id):
        comment = get_object_or_404(
            Comment.objects.select_related("activity"), pk=comment_id, deleted_at__isnull=True
        )
        if not activity_visible_to(request.user, comment.activity):
            raise Http404
        return Response({"detail": "Comments cannot be deleted."}, status=403)


class ActivityParticipationView(APIView):
    """POST/DELETE /api/activities/<id>/participation/ — RSVP to an event."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        if activity.kind != Activity.Kind.EVENTS:
            raise ValidationError({"detail": "Only events accept participation."})
        set_event_participation(activity, request.user)
        return Response({"status": "going"})

    def delete(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        remove_event_participation(activity, request.user)
        return Response(status=204)


class UserAttendingEventsView(APIView):
    """GET /api/me/events/attending/ — events the viewer RSVP'd to."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from orgs.views import calendar_event_summary

        from .models import EventParticipation

        activities = (
            Activity.objects.filter(
                participations__user=request.user,
                participations__status=EventParticipation.Status.GOING,
                kind=Activity.Kind.EVENTS,
            )
            .select_related("org", "author", "author__investorprofile")
            .order_by("occurred_at")
            .distinct()
        )
        exclude_org = request.query_params.get("exclude_org")
        if exclude_org:
            activities = activities.exclude(org__slug=exclude_org)
        return Response([calendar_event_summary(a) for a in activities])


class MentionSearchView(APIView):
    """GET /api/mentions/search/?q= — backs the composer's @-autocomplete."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "")
        return Response(search_mentionable(request.user, query))


class LinkPreviewView(APIView):
    """GET /api/links/preview/?url= — on-demand rich-link unfurl (spec §A2).
    The frontend calls this per unique http(s) URL it detects in a post/
    comment body; results are cached server-side by URL, so repeated posts
    of the same link only ever hit the third-party unfurl service once."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        url = request.query_params.get("url", "").strip()
        if not url:
            return Response({"detail": "url is required."}, status=400)
        enforce_rate_limit(
            f"link_preview:{request.user.id}", limit=LINK_PREVIEWS_PER_HOUR, window_seconds=3600
        )
        preview = get_or_fetch_preview(url)
        if preview is None or preview.status != preview.Status.READY:
            return Response({"status": "unavailable"})
        return Response(
            {
                "status": "ready",
                "url": preview.url,
                "title": preview.title,
                "description": preview.description,
                "image_url": preview.image_url,
                "site_name": preview.site_name,
            }
        )
