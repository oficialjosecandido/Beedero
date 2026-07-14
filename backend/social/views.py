from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.pagination import decode_cursor, encode_cursor
from beedero.ratelimit import enforce_rate_limit
from orgs.models import OrgMembership
from orgs.visibility import activity_visible_to

from .models import Comment
from .permissions import IsCommentAuthorOrOrgOwner
from .serializers import CommentCreateSerializer, ReactionSerializer, comment_summary
from .services import (
    create_comment,
    get_visible_activity_or_404,
    remove_reaction,
    soft_delete_comment,
    toggle_reaction,
)

REACTIONS_PER_DAY = 200
COMMENTS_PER_DAY = 30


def _can_delete(user, comment):
    if comment.author_id == user.id:
        return True
    org_id = comment.activity.org_id
    if not org_id:
        return False
    return OrgMembership.objects.filter(
        org_id=org_id, user=user, role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
    ).exists()


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
        return Response({"reaction_count": activity.reaction_count})

    def delete(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        remove_reaction(activity, request.user)
        activity.refresh_from_db(fields=["reaction_count"])
        return Response({"reaction_count": activity.reaction_count})


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
            Comment.objects.filter(activity=activity, deleted_at__isnull=True)
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
                "items": [comment_summary(c, can_delete=_can_delete(request.user, c)) for c in comments],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request, activity_id):
        activity = get_visible_activity_or_404(request.user, activity_id)
        enforce_rate_limit(f"comment:{request.user.id}", limit=COMMENTS_PER_DAY, window_seconds=86400)

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        parent = None
        parent_id = data.get("parent_id")
        if parent_id is not None:
            parent = get_object_or_404(Comment, pk=parent_id, activity=activity)
            if parent.parent_id is not None:
                return Response({"detail": "Replies can only be one level deep."}, status=400)

        comment = create_comment(activity, request.user, data["body"], parent=parent)
        activity.refresh_from_db(fields=["comment_count"])
        from notifications.services import notify_activity_comment

        notify_activity_comment(activity, request.user, activity.comment_count)
        return Response(comment_summary(comment, can_delete=True), status=201)


class CommentDeleteView(APIView):
    """DELETE /api/comments/<id>/ — soft delete. Visibility is checked
    before the author/owner check so a viewer who can't see the activity at
    all gets 404, never a 403 that would confirm the comment exists."""

    permission_classes = [permissions.IsAuthenticated, IsCommentAuthorOrOrgOwner]

    def delete(self, request, comment_id):
        comment = get_object_or_404(
            Comment.objects.select_related("activity"), pk=comment_id, deleted_at__isnull=True
        )
        if not activity_visible_to(request.user, comment.activity):
            raise Http404
        self.check_object_permissions(request, comment)
        soft_delete_comment(comment)
        return Response(status=204)
