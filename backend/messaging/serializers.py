from rest_framework import serializers

from accounts.models import InvestorProfile

from .models import Conversation, Message


def _investor_profile(user):
    try:
        return user.investorprofile
    except InvestorProfile.DoesNotExist:
        return None


def _display_name(user):
    profile = _investor_profile(user)
    return (profile.full_name if profile and profile.full_name else None) or user.email


def _profile_picture(user):
    profile = _investor_profile(user)
    if not profile or not profile.profile_picture:
        return None
    try:
        return profile.profile_picture.url
    except Exception:
        return None


class StartConversationSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class MessageSendSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000)

    def validate_body(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Message can't be empty.")
        return stripped


def conversation_summary(conversation: Conversation, viewer, unread_count: int) -> dict:
    other = (
        conversation.participant_two
        if conversation.participant_one_id == viewer.id
        else conversation.participant_one
    )
    last_message_body = getattr(conversation, "last_message_body", None)
    last_message_sender_id = getattr(conversation, "last_message_sender_id", None)
    last_message = None
    if last_message_body:
        last_message = {
            "body": last_message_body,
            "is_mine": last_message_sender_id == viewer.id,
        }
    return {
        "id": conversation.id,
        "other_participant": {
            "id": other.id,
            "name": _display_name(other),
            "profile_picture": _profile_picture(other),
        },
        "last_message": last_message,
        "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        "unread_count": unread_count,
    }


def message_summary(message: Message, viewer) -> dict:
    return {
        "id": message.id,
        "body": message.body,
        "created_at": message.created_at.isoformat(),
        "is_mine": message.sender_id == viewer.id,
    }
