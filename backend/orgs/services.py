"""Shared by FeedPostView (org posts) and accounts.InvestorPostListCreateView
(investor posts) — kept as two thin endpoints rather than unified into one
(they still differ in permissions/validation/daily-cap subject), but both
land in the same Activity row shape."""

from .models import Activity


def create_activity(*, org=None, author=None, kind, title, body="", occurred_at, image=None, visibility):
    return Activity.objects.create(
        org=org,
        author=author,
        kind=kind,
        title=title,
        body=body,
        image=image,
        occurred_at=occurred_at,
        visibility=visibility,
    )
