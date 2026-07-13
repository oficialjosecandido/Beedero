"""Shared by ActivityReactionView/ActivityCommentListCreateView/CommentDeleteView
— counter maintenance always goes through F() here, never `.count()`, so
concurrent requests can't race a read-modify-write."""

from django.db import transaction
from django.db.models import F
from django.http import Http404
from django.shortcuts import get_object_or_404

from orgs.models import Activity
from orgs.visibility import activity_visible_to

from .models import Comment, Reaction


def viewer_reactions_for(user, activity_ids) -> dict[int, str]:
    """Batched lookup for the feed's `viewer_reaction` field — one query for
    the whole page instead of one per Activity."""
    if not user or not user.is_authenticated:
        return {}
    return dict(
        Reaction.objects.filter(user=user, activity_id__in=list(activity_ids)).values_list(
            "activity_id", "kind"
        )
    )


def get_visible_activity_or_404(viewer, activity_id: int) -> Activity:
    """Always 404, never 403 — a 403 would itself leak "this exists but you
    can't see it" (plan §7, guard-test)."""
    activity = get_object_or_404(Activity, pk=activity_id)
    if not activity_visible_to(viewer, activity):
        raise Http404
    return activity


@transaction.atomic
def toggle_reaction(activity: Activity, user, kind: str) -> Reaction:
    """A second reaction from the same user updates the kind in place rather
    than being ignored — more intuitive than "sticky until DELETE"."""
    reaction, created = Reaction.objects.get_or_create(
        activity=activity, user=user, defaults={"kind": kind}
    )
    if created:
        Activity.objects.filter(pk=activity.pk).update(reaction_count=F("reaction_count") + 1)
    elif reaction.kind != kind:
        reaction.kind = kind
        reaction.save(update_fields=["kind"])
    return reaction


@transaction.atomic
def remove_reaction(activity: Activity, user) -> None:
    deleted, _ = Reaction.objects.filter(activity=activity, user=user).delete()
    if deleted:
        Activity.objects.filter(pk=activity.pk).update(reaction_count=F("reaction_count") - 1)


@transaction.atomic
def create_comment(activity: Activity, author, body: str, parent: Comment | None = None) -> Comment:
    comment = Comment.objects.create(activity=activity, author=author, body=body, parent=parent)
    Activity.objects.filter(pk=activity.pk).update(comment_count=F("comment_count") + 1)
    return comment


@transaction.atomic
def soft_delete_comment(comment: Comment) -> None:
    from django.utils import timezone

    comment.deleted_at = timezone.now()
    comment.save(update_fields=["deleted_at"])
    Activity.objects.filter(pk=comment.activity_id).update(comment_count=F("comment_count") - 1)
