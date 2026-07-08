"""Org activity feed (§4) — kept as a plain function, mirroring discover()
and public_profile(), so it's testable without going through the view."""

from django.utils.dateparse import parse_datetime

from .constants import ACTIVITY_KINDS
from .models import OrgField
from .visibility import VisibilityResolver


def occurred_at_of(post: OrgField):
    """The event time used for feed ordering: the user-supplied `occurred_at`
    when present and parseable, otherwise when the post was created."""
    raw = post.value.get("occurred_at")
    return (parse_datetime(raw) if raw else None) or post.created_at


def org_feed_items(viewer, followed_org_ids, limit=50):
    """Activity-section fields from followed orgs.

    Activity sections default to public visibility, but that's a default,
    not a guarantee — a section's visibility can still be overridden, so
    this must go through the same resolver profile reads use (§3.2) rather
    than trusting "it's an activity field" blindly.
    """
    candidate_posts = (
        OrgField.objects.filter(section__org_id__in=followed_org_ids, section__kind__in=ACTIVITY_KINDS)
        .select_related("section__org")
        .order_by("-created_at")[: limit * 4]
    )
    visible_ids_by_org: dict[int, set[int]] = {}
    posts = []
    for post in candidate_posts:
        org_id = post.section.org_id
        if org_id not in visible_ids_by_org:
            resolver = VisibilityResolver(viewer=viewer, org=post.section.org)
            visible_ids_by_org[org_id] = set(resolver.visible_fields().values_list("id", flat=True))
        if post.id in visible_ids_by_org[org_id]:
            posts.append(post)
        if len(posts) >= limit:
            break
    return posts
