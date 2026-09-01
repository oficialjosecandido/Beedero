from django.contrib.auth import get_user_model
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import InvestorProfile
from beedero.pagination import decode_cursor, encode_cursor
from beedero.ratelimit import enforce_rate_limit
from connections.models import Connection
from connections.services import can_message_directly, can_message_org_directly
from orgs.permissions import OrgLookupMixin

from .models import Conversation, Message, OrgConversation, OrgMessage, UserBlock
from .serializers import (
    BlockUserSerializer,
    MessageSendSerializer,
    ReportConversationSerializer,
    StartConversationSerializer,
    _display_name,
    _profile_picture,
    blocked_user_summary,
    conversation_summary,
    message_summary,
    org_conversation_summary,
    org_message_summary,
)
from .services import (
    block_user,
    create_report,
    get_or_create_conversation,
    get_or_create_org_conversation,
    get_visible_conversation_or_404,
    get_visible_org_conversation_or_404,
    is_blocked,
    is_org_member,
    mark_conversation_read,
    mark_org_conversation_read,
    send_message,
    send_org_message,
    unblock_user,
)

User = get_user_model()

CONVERSATIONS_PER_DAY = 30
MESSAGES_PER_HOUR = 60
REPORTS_PER_DAY = 20

BLOCKED_DETAIL = "You can't contact this user."
CONTACT_GATE_DETAIL = "You need to connect first. Send a connection request to start a conversation."


class MessageContactsView(APIView):
    """GET /api/contacts/ — people the viewer is connected to."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        viewer = request.user
        as_one = Connection.objects.filter(user_one=viewer).values_list("user_two_id", flat=True)
        as_two = Connection.objects.filter(user_two=viewer).values_list("user_one_id", flat=True)
        contact_ids = set(as_one) | set(as_two)

        profiles = {
            profile.user_id: profile
            for profile in InvestorProfile.objects.filter(user_id__in=contact_ids).select_related("user")
        }
        users = User.objects.filter(id__in=contact_ids).order_by("email")
        items = []
        for user in users:
            profile = profiles.get(user.id)
            items.append(
                {
                    "id": user.id,
                    "name": _display_name(user),
                    "headline": profile.headline if profile else "",
                    "profile_picture": _profile_picture(user),
                }
            )
        items.sort(key=lambda item: item["name"].casefold())
        return Response({"items": items})


class ConversationListCreateView(APIView):
    """GET (up to 50 conversations, newest activity first) / POST
    /api/conversations/. No cursor pagination here — unlike the feed/comments,
    the number of conversations a user has is small enough that a flat cap
    is simpler and sufficient (documented trade-off, plan §1.6)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        viewer = request.user
        last_messages = Message.objects.filter(conversation=OuterRef("pk")).order_by("-created_at", "-id")
        conversations = (
            Conversation.objects.filter(Q(participant_one=viewer) | Q(participant_two=viewer))
            .select_related(
                "participant_one__investorprofile",
                "participant_two__investorprofile",
            )
            .annotate(
                unread_count=Count(
                    "messages",
                    filter=Q(messages__read_at__isnull=True) & ~Q(messages__sender=viewer),
                ),
                last_message_body=Subquery(last_messages.values("body")[:1]),
                last_message_sender_id=Subquery(last_messages.values("sender_id")[:1]),
            )
            .order_by("-last_message_at", "-created_at")[:50]
        )
        return Response(
            {"items": [conversation_summary(c, viewer, c.unread_count) for c in conversations]}
        )

    def post(self, request):
        serializer = StartConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_id = serializer.validated_data["user_id"]

        if target_id == request.user.id:
            return Response({"detail": "You can't message yourself."}, status=400)
        target = get_object_or_404(User, pk=target_id)

        if is_blocked(request.user, target):
            raise PermissionDenied(BLOCKED_DETAIL)

        if not can_message_directly(request.user, target):
            raise PermissionDenied(CONTACT_GATE_DETAIL)

        enforce_rate_limit(
            f"start-conversation:{request.user.id}", limit=CONVERSATIONS_PER_DAY, window_seconds=86400
        )
        conversation = get_or_create_conversation(request.user, target)
        conversation = (
            Conversation.objects.filter(pk=conversation.pk)
            .select_related("participant_one__investorprofile", "participant_two__investorprofile")
            .get()
        )
        return Response(conversation_summary(conversation, request.user, 0), status=201)


class ConversationMessageListCreateView(APIView):
    """GET (keyset paginated, newest first) / POST
    /api/conversations/<id>/messages/. Opening the thread (GET) marks every
    unread message not sent by the viewer as read — a real "opened the
    conversation" semantic, not just the fetched page."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 30
    MAX_LIMIT = 100

    def get(self, request, conversation_id):
        conversation = get_visible_conversation_or_404(request.user, conversation_id)

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

        qs = Message.objects.filter(conversation=conversation).select_related("sender").order_by(
            "-created_at", "-id"
        )
        if cursor is not None:
            created_at, item_id = cursor
            qs = qs.filter(Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=int(item_id)))

        messages = list(qs[: limit + 1])
        next_cursor = None
        if len(messages) > limit:
            last = messages[limit - 1]
            next_cursor = encode_cursor(last.created_at, last.id)
            messages = messages[:limit]

        mark_conversation_read(conversation, request.user)

        return Response(
            {
                "items": [message_summary(m, request.user) for m in messages],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request, conversation_id):
        conversation = get_visible_conversation_or_404(request.user, conversation_id)
        other = (
            conversation.participant_two
            if conversation.participant_one_id == request.user.id
            else conversation.participant_one
        )
        if is_blocked(request.user, other):
            raise PermissionDenied(BLOCKED_DETAIL)

        enforce_rate_limit(
            f"send-message:{request.user.id}", limit=MESSAGES_PER_HOUR, window_seconds=3600
        )

        serializer = MessageSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = send_message(conversation, request.user, serializer.validated_data["body"])
        return Response(message_summary(message, request.user), status=201)


class OrgConversationListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/conversations/ — org inbox for members."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        org = self.get_org()
        if not is_org_member(org, request.user):
            raise Http404
        viewer = request.user
        last_messages = OrgMessage.objects.filter(org_conversation=OuterRef("pk")).order_by(
            "-created_at", "-id"
        )
        conversations = (
            OrgConversation.objects.filter(org=org)
            .select_related("external_user__investorprofile")
            .annotate(
                unread_count=Count(
                    "messages",
                    filter=Q(messages__read_at__isnull=True) & Q(messages__sender_id=F("external_user_id")),
                ),
                last_message_body=Subquery(last_messages.values("body")[:1]),
                last_message_sender_id=Subquery(last_messages.values("sender_id")[:1]),
            )
            .order_by("-last_message_at", "-created_at")[:50]
        )
        return Response(
            {
                "items": [
                    org_conversation_summary(c, viewer, c.unread_count) for c in conversations
                ]
            }
        )

    def post(self, request, slug):
        org = self.get_org()
        viewer = request.user

        if is_org_member(org, viewer):
            serializer = StartConversationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            target_id = serializer.validated_data["user_id"]
            if target_id == viewer.id:
                return Response({"detail": "You can't message yourself."}, status=400)
            target = get_object_or_404(User, pk=target_id)
            if not can_message_org_directly(target, org):
                raise PermissionDenied(CONTACT_GATE_DETAIL)

            enforce_rate_limit(
                f"start-org-conversation:{viewer.id}:{org.id}",
                limit=CONVERSATIONS_PER_DAY,
                window_seconds=86400,
            )
            conversation = get_or_create_org_conversation(org, target)
        else:
            if not can_message_org_directly(viewer, org):
                raise PermissionDenied(CONTACT_GATE_DETAIL)
            enforce_rate_limit(
                f"start-org-conversation-external:{viewer.id}:{org.id}",
                limit=CONVERSATIONS_PER_DAY,
                window_seconds=86400,
            )
            conversation = get_or_create_org_conversation(org, viewer)

        conversation = (
            OrgConversation.objects.filter(pk=conversation.pk)
            .select_related("external_user__investorprofile")
            .get()
        )
        return Response(org_conversation_summary(conversation, viewer, 0), status=201)


class OrgConversationMessageListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/conversations/<id>/messages/."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 30
    MAX_LIMIT = 100

    def get(self, request, slug, conversation_id):
        org = self.get_org()
        conversation = get_visible_org_conversation_or_404(org, request.user, conversation_id)

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

        qs = OrgMessage.objects.filter(org_conversation=conversation).select_related("sender").order_by(
            "-created_at", "-id"
        )
        if cursor is not None:
            created_at, item_id = cursor
            qs = qs.filter(Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=int(item_id)))

        messages = list(qs[: limit + 1])
        next_cursor = None
        if len(messages) > limit:
            last = messages[limit - 1]
            next_cursor = encode_cursor(last.created_at, last.id)
            messages = messages[:limit]

        mark_org_conversation_read(conversation, request.user)

        return Response(
            {
                "items": [org_message_summary(m, request.user) for m in messages],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request, slug, conversation_id):
        org = self.get_org()
        conversation = get_visible_org_conversation_or_404(org, request.user, conversation_id)
        if not (
            conversation.external_user_id == request.user.id or is_org_member(org, request.user)
        ):
            raise Http404

        enforce_rate_limit(
            f"send-org-message:{request.user.id}", limit=MESSAGES_PER_HOUR, window_seconds=3600
        )

        serializer = MessageSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = send_org_message(conversation, request.user, serializer.validated_data["body"])
        return Response(org_message_summary(message, request.user), status=201)


class BlockListCreateView(APIView):
    """GET/POST /api/blocks/ — the viewer's own block list."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        blocks = UserBlock.objects.filter(blocker=request.user).select_related(
            "blocked__investorprofile"
        )
        return Response({"items": [blocked_user_summary(b) for b in blocks]})

    def post(self, request):
        serializer = BlockUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_id = serializer.validated_data["user_id"]
        if target_id == request.user.id:
            return Response({"detail": "You can't block yourself."}, status=400)
        target = get_object_or_404(User, pk=target_id)
        block_user(request.user, target)
        return Response(status=204)


class BlockDetailView(APIView):
    """DELETE /api/blocks/<user_id>/ — unblock."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        unblock_user(request.user, target)
        return Response(status=204)


class ConversationReportView(APIView):
    """POST /api/conversations/<id>/report/ — flag the other participant for
    abuse/unsolicited contact. Doesn't block automatically — the reporter
    still has to call BlockListCreateView.post for that, since reporting and
    blocking are independent actions (you might report without blocking, or
    block without reporting)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_visible_conversation_or_404(request.user, conversation_id)
        enforce_rate_limit(
            f"report-conversation:{request.user.id}", limit=REPORTS_PER_DAY, window_seconds=86400
        )

        serializer = ReportConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        create_report(
            reporter=request.user,
            conversation=conversation,
            reason=serializer.validated_data["reason"],
            details=serializer.validated_data["details"],
        )
        return Response(status=201)
