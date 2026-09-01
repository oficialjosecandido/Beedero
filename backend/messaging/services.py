"""Shared by ConversationListCreateView/ConversationMessageListCreateView —
mirrors social/services.py's counter/visibility conventions."""

from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from django.db.models import F, Q

from orgs.models import OrgMembership

from .models import Conversation, Message, MessageReport, OrgConversation, OrgMessage, UserBlock


BLOCKED_DETAIL = "You can't contact this user."


def is_blocked(user_a, user_b) -> bool:
    """True if either user has blocked the other — checked in both
    directions since a block should stop contact regardless of who
    initiates (doc: "contacto por aceitação mútua, nunca mensagens não
    solicitadas")."""
    return UserBlock.objects.filter(
        Q(blocker=user_a, blocked=user_b) | Q(blocker=user_b, blocked=user_a)
    ).exists()


def block_user(blocker, blocked) -> None:
    if blocker.id == blocked.id:
        raise ValueError("A user can't block themselves.")
    UserBlock.objects.get_or_create(blocker=blocker, blocked=blocked)


def unblock_user(blocker, blocked) -> None:
    UserBlock.objects.filter(blocker=blocker, blocked=blocked).delete()


def create_report(*, reporter, conversation: Conversation, reason: str, details: str = "") -> MessageReport:
    other = (
        conversation.participant_two
        if conversation.participant_one_id == reporter.id
        else conversation.participant_one
    )
    return MessageReport.objects.create(
        reporter=reporter, reported_user=other, conversation=conversation, reason=reason, details=details
    )


def get_or_create_conversation(user_a, user_b) -> Conversation:
    """Orders the pair by pk before get_or_create so the two participant
    FKs always satisfy the conversation_ordered_pair CheckConstraint,
    regardless of who initiates."""
    if user_a.id == user_b.id:
        raise ValueError("A conversation needs two distinct participants.")
    first, second = sorted([user_a, user_b], key=lambda u: u.id)
    conversation, _ = Conversation.objects.get_or_create(participant_one=first, participant_two=second)
    return conversation


def get_visible_conversation_or_404(viewer, conversation_id: int) -> Conversation:
    """Always 404, never 403 — same anti-enumeration rule as
    social.services.get_visible_activity_or_404: a 403 would itself confirm
    the conversation exists."""
    conversation = get_object_or_404(Conversation, pk=conversation_id)
    if viewer.id not in (conversation.participant_one_id, conversation.participant_two_id):
        raise Http404
    return conversation


@transaction.atomic
def send_message(conversation: Conversation, sender, body: str) -> Message:
    message = Message.objects.create(conversation=conversation, sender=sender, body=body)
    Conversation.objects.filter(pk=conversation.pk).update(last_message_at=message.created_at)
    return message


def mark_conversation_read(conversation: Conversation, viewer) -> None:
    Message.objects.filter(conversation=conversation, read_at__isnull=True).exclude(sender=viewer).update(
        read_at=timezone.now()
    )


def get_or_create_org_conversation(org, external_user) -> OrgConversation:
    conversation, _ = OrgConversation.objects.get_or_create(org=org, external_user=external_user)
    return conversation


def is_org_member(org, user) -> bool:
    return OrgMembership.objects.filter(org=org, user=user).exists()


def get_visible_org_conversation_or_404(org, viewer, conversation_id: int) -> OrgConversation:
    conversation = get_object_or_404(OrgConversation, pk=conversation_id, org=org)
    if conversation.external_user_id == viewer.id:
        return conversation
    if is_org_member(org, viewer):
        return conversation
    raise Http404


@transaction.atomic
def send_org_message(conversation: OrgConversation, sender, body: str) -> OrgMessage:
    message = OrgMessage.objects.create(org_conversation=conversation, sender=sender, body=body)
    OrgConversation.objects.filter(pk=conversation.pk).update(last_message_at=message.created_at)
    return message


def mark_org_conversation_read(conversation: OrgConversation, viewer) -> None:
    if conversation.external_user_id == viewer.id:
        OrgMessage.objects.filter(
            org_conversation=conversation, read_at__isnull=True
        ).exclude(sender=viewer).update(read_at=timezone.now())
        return
    if is_org_member(conversation.org, viewer):
        OrgMessage.objects.filter(
            org_conversation=conversation,
            read_at__isnull=True,
            sender=conversation.external_user,
        ).update(read_at=timezone.now())


def total_unread_count(viewer) -> int:
    """Unread DMs for the badge — personal inbox plus org threads where the
    viewer is the external party or an org member reviewing inbound contact."""
    personal = (
        Message.objects.filter(read_at__isnull=True)
        .exclude(sender_id=viewer.id)
        .filter(
            Q(conversation__participant_one_id=viewer.id)
            | Q(conversation__participant_two_id=viewer.id)
        )
        .count()
    )
    external_org = (
        OrgMessage.objects.filter(
            read_at__isnull=True,
            org_conversation__external_user_id=viewer.id,
        )
        .exclude(sender_id=viewer.id)
        .count()
    )
    member_org = OrgMessage.objects.filter(
        read_at__isnull=True,
        org_conversation__org__members__user_id=viewer.id,
        sender_id=F("org_conversation__external_user_id"),
    ).count()
    return personal + external_org + member_org
