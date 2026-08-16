"""Shared by FeedPostView (org posts) and accounts.InvestorPostListCreateView
(investor posts) — kept as two thin endpoints rather than unified into one
(they still differ in permissions/validation/daily-cap subject), but both
land in the same Activity row shape."""

from .models import Activity, Organization, OrgMembership


def create_activity(*, org=None, author=None, kind, title, body="", occurred_at, ends_at=None, image=None, visibility, payload=None):
    return Activity.objects.create(
        org=org,
        author=author,
        kind=kind,
        title=title,
        body=body,
        image=image,
        occurred_at=occurred_at,
        ends_at=ends_at,
        visibility=visibility,
        payload=payload or {},
    )


def sole_owner_orgs(user):
    """Orgs where `user` is an owner and no other owner exists."""
    owned_org_ids = OrgMembership.objects.filter(
        user=user, role=OrgMembership.Role.OWNER
    ).values_list("org_id", flat=True)
    other_owner_org_ids = OrgMembership.objects.filter(
        org_id__in=owned_org_ids, role=OrgMembership.Role.OWNER
    ).exclude(user=user).values_list("org_id", flat=True)
    return Organization.objects.filter(id__in=owned_org_ids).exclude(id__in=other_owner_org_ids)
