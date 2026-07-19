"""Org + investor activity feed (§4). A plain function, mirroring discover()
and public_profile(), so it's testable without going through the view."""

from django.db.models import Q

from .models import Activity, OrgMembership, Visibility


def activity_feed_items(viewer, followed_org_ids, followed_user_ids, limit=50, cursor=None):
    """Activities from followed orgs, followed people, and the viewer's own
    personal posts, newest first.

    Visibility is filtered in the same query (mirrors the `activity_visibility`
    RLS policy applied at the DB layer as defense in depth): public activities,
    investor-authored activities (always public today), and anything from an
    org the viewer is a member of. `cursor`, if given, is a (created_at, id)
    tuple as returned by `beedero.pagination.decode_cursor` — keyset paging
    entirely in SQL rather than the old two-Python-list merge/sort/paginate.
    """
    member_org_ids = set()
    if viewer is not None and viewer.is_authenticated:
        member_org_ids = set(
            OrgMembership.objects.filter(user=viewer).values_list("org_id", flat=True)
        )

    viewer_id = viewer.id if viewer is not None and viewer.is_authenticated else None

    visibility_filter = (
        Q(org_id__in=followed_org_ids)
        | Q(org_id__in=member_org_ids)
        | Q(author_id__in=followed_user_ids, org__isnull=True)
    )
    if viewer_id is not None:
        visibility_filter |= Q(author_id=viewer_id, org__isnull=True)

    qs = (
        Activity.objects.filter(visibility_filter)
        .filter(Q(visibility=Visibility.PUBLIC) | Q(org__isnull=True) | Q(org_id__in=member_org_ids))
        .select_related("org", "author")
    )
    if cursor is not None:
        created_at, item_id = cursor
        qs = qs.filter(
            Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=int(item_id))
        )
    return qs.order_by("-created_at", "-id")[:limit]
