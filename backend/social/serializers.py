from rest_framework import serializers

from .models import Comment, Reaction


def _author_display_name(user):
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or user.email


class ReactionSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Reaction.Kind.choices)


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)
    parent_id = serializers.IntegerField(required=False, allow_null=True)


def comment_summary(comment: Comment, *, can_delete: bool) -> dict:
    return {
        "id": comment.id,
        "parent_id": comment.parent_id,
        "author_name": _author_display_name(comment.author),
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
        "can_delete": can_delete,
    }
