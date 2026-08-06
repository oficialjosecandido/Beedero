from rest_framework import serializers

from .models import Comment, Reaction


def _author_display_name(user):
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or user.email


class ReactionSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Reaction.Kind.choices)


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)


def _author_profile_fields(user) -> dict:
    profile = getattr(user, "investorprofile", None)
    handle = profile.handle if profile and profile.is_complete and profile.handle else None
    picture = profile.profile_picture.url if profile and profile.profile_picture else None
    return {
        "author_id": user.id,
        "author_handle": handle,
        "author_profile_picture": picture,
    }


def comment_summary(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "author_name": _author_display_name(comment.author),
        **_author_profile_fields(comment.author),
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
    }
