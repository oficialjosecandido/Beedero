"""Shared by ActivityReactionView/ActivityCommentListCreateView/CommentDeleteView
— counter maintenance always goes through F() here, never `.count()`, so
concurrent requests can't race a read-modify-write."""

from django.db import transaction
from django.db.models import Count, F
from django.http import Http404
from django.shortcuts import get_object_or_404

from orgs.models import Activity
from orgs.visibility import activity_visible_to

from .models import Comment, EventParticipation, Reaction

REACTION_KINDS = ("like", "insight", "congrats")


def _empty_reaction_counts() -> dict[str, int]:
    return {kind: 0 for kind in REACTION_KINDS}


def reaction_counts_for(activity_ids) -> dict[int, dict[str, int]]:
    """Per-kind reaction totals for a batch of activities."""
    counts = {activity_id: _empty_reaction_counts() for activity_id in activity_ids}
    if not activity_ids:
        return counts
    rows = (
        Reaction.objects.filter(activity_id__in=list(activity_ids))
        .values("activity_id", "kind")
        .annotate(total=Count("id"))
    )
    for row in rows:
        kind = row["kind"]
        if kind in counts[row["activity_id"]]:
            counts[row["activity_id"]][kind] = row["total"]
    return counts


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


def viewer_has_commented_for(user, activity_ids) -> set[int]:
    """Activities the viewer has already commented on (one comment per user)."""
    if not user or not user.is_authenticated or not activity_ids:
        return set()
    return set(
        Comment.objects.filter(
            author=user,
            activity_id__in=list(activity_ids),
            deleted_at__isnull=True,
        ).values_list("activity_id", flat=True)
    )


def viewer_participations_for(user, activity_ids) -> dict[int, str]:
    if not user or not user.is_authenticated or not activity_ids:
        return {}
    return dict(
        EventParticipation.objects.filter(
            user=user, activity_id__in=list(activity_ids), status=EventParticipation.Status.GOING
        ).values_list("activity_id", "status")
    )


@transaction.atomic
def set_event_participation(activity: Activity, user) -> EventParticipation:
    participation, _ = EventParticipation.objects.get_or_create(
        activity=activity, user=user, defaults={"status": EventParticipation.Status.GOING}
    )
    if participation.status != EventParticipation.Status.GOING:
        participation.status = EventParticipation.Status.GOING
        participation.save(update_fields=["status"])
    return participation


@transaction.atomic
def remove_event_participation(activity: Activity, user) -> None:
    EventParticipation.objects.filter(activity=activity, user=user).delete()


def user_has_commented(activity: Activity, user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return Comment.objects.filter(
        activity=activity, author=user, deleted_at__isnull=True
    ).exists()


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
    if body:
        from .mentions import handle_mentions

        handle_mentions(actor=author, body=body, comment=comment)
    return comment


@transaction.atomic
def soft_delete_comment(comment: Comment) -> None:
    from django.utils import timezone

    comment.deleted_at = timezone.now()
    comment.save(update_fields=["deleted_at"])
    Activity.objects.filter(pk=comment.activity_id).update(comment_count=F("comment_count") - 1)
