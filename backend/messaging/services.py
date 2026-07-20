"""Shared by ConversationListCreateView/ConversationMessageListCreateView —
mirrors social/services.py's counter/visibility conventions."""

from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from orgs.models import OrgMembership

from .models import Conversation, Message, OrgConversation, OrgMessage


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
