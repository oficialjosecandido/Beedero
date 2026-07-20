"""Feed impression tracking — one counted view per viewer per activity."""

from django.db.models import F

from orgs.models import Activity

from .models import ActivityFeedImpression


def record_feed_impressions(viewer, activities) -> None:
    """Record that `viewer` was served these activities in their feed.

    Each viewer counts at most once per activity. The author's own posts are
    excluded — seeing your update in your feed is not a "reader".
    """
    if not viewer or not getattr(viewer, "is_authenticated", False):
        return

    candidate_ids = [a.id for a in activities if a.author_id != viewer.id]
    if not candidate_ids:
        return

    existing_ids = set(
        ActivityFeedImpression.objects.filter(
            viewer=viewer, activity_id__in=candidate_ids
        ).values_list("activity_id", flat=True)
    )
    new_ids = [activity_id for activity_id in candidate_ids if activity_id not in existing_ids]
    if not new_ids:
        return

    ActivityFeedImpression.objects.bulk_create(
        [ActivityFeedImpression(activity_id=activity_id, viewer=viewer) for activity_id in new_ids]
    )
    Activity.objects.filter(id__in=new_ids).update(feed_impression_count=F("feed_impression_count") + 1)
