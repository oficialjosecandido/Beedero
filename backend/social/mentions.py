"""@[user:<handle>] / @[org:<slug>] marker parsing, resolution, and search.

Markers are the only mention representation stored in body text — never raw
`@name` — because handles/slugs are stable and unambiguous while display
names change and collide (spec "Rich Links & Menções" §B).
"""

import re

from django.db.models import Q

from accounts.models import InvestorProfile
from orgs.models import Organization

from .models import Mention

MAX_MENTIONS_PER_BODY = 5
MENTION_NOTIFICATIONS_PER_DAY = 100

_MARKER_RE = re.compile(r"@\[(user|org):([a-zA-Z0-9_-]+)\]")


def parse_mention_markers(body: str) -> list[tuple[str, str]]:
    """Ordered, de-duplicated (kind, identifier) pairs, capped at
    MAX_MENTIONS_PER_BODY. Markers beyond the cap are left in the body as
    literal text — still rendered, just not resolved/notified."""
    seen = set()
    markers: list[tuple[str, str]] = []
    for kind, identifier in _MARKER_RE.findall(body or ""):
        key = (kind, identifier.lower())
        if key in seen:
            continue
        seen.add(key)
        markers.append((kind, identifier))
        if len(markers) >= MAX_MENTIONS_PER_BODY:
            break
    return markers


def resolve_mentions(body: str) -> list[dict]:
    """Marker -> display info, embedded in feed/comment responses so the
    frontend can render clickable names without an extra round trip."""
    markers = parse_mention_markers(body)
    if not markers:
        return []

    user_handles = [identifier for kind, identifier in markers if kind == "user"]
    org_slugs = [identifier for kind, identifier in markers if kind == "org"]

    profiles = {
        p.handle: p
        for p in InvestorProfile.objects.filter(handle__in=user_handles).select_related("user")
    }
    orgs = {o.slug: o for o in Organization.objects.filter(slug__in=org_slugs)}

    resolved = []
    for kind, identifier in markers:
        if kind == "user":
            profile = profiles.get(identifier)
            if not profile:
                continue
            resolved.append(
                {
                    "marker": f"@[user:{identifier}]",
                    "type": "user",
                    "handle": identifier,
                    "name": profile.full_name or profile.user.email,
                }
            )
        else:
            org = orgs.get(identifier)
            if not org:
                continue
            resolved.append(
                {
                    "marker": f"@[org:{identifier}]",
                    "type": "org",
                    "slug": identifier,
                    "name": org.name,
                }
            )
    return resolved


def create_mentions(*, actor, body: str, activity=None, comment=None) -> list[Mention]:
    """Persists Mention rows for markers that resolve to a real user/org, to
    back notification fan-out. Called once at creation time — posts/comments
    aren't editable in this codebase, so Mention rows never need updating."""
    markers = parse_mention_markers(body)
    if not markers:
        return []

    user_handles = [identifier for kind, identifier in markers if kind == "user"]
    org_slugs = [identifier for kind, identifier in markers if kind == "org"]
    profiles = {p.handle: p for p in InvestorProfile.objects.filter(handle__in=user_handles)}
    orgs = {o.slug: o for o in Organization.objects.filter(slug__in=org_slugs)}

    mentions = []
    for kind, identifier in markers:
        if kind == "user":
            profile = profiles.get(identifier)
            if not profile or profile.user_id == actor.id:
                continue
            mentions.append(
                Mention(actor=actor, activity=activity, comment=comment, target_user_id=profile.user_id)
            )
        else:
            org = orgs.get(identifier)
            if not org:
                continue
            mentions.append(Mention(actor=actor, activity=activity, comment=comment, target_org=org))

    if not mentions:
        return []
    return Mention.objects.bulk_create(mentions)


def handle_mentions(*, actor, body: str, activity=None, comment=None) -> None:
    """Single entry point called from create_activity/create_comment: creates
    Mention rows for markers in `body` and fires a notification for each,
    up to a per-actor daily cap — a burst of mentions stops notifying (the
    Mention rows themselves are still created) rather than failing the
    post/comment that's already been saved."""
    from rest_framework.exceptions import Throttled

    from beedero.ratelimit import enforce_rate_limit
    from notifications.services import notify_mention

    for mention in create_mentions(actor=actor, body=body, activity=activity, comment=comment):
        try:
            enforce_rate_limit(
                f"mention:{actor.id}", limit=MENTION_NOTIFICATIONS_PER_DAY, window_seconds=86400
            )
        except Throttled:
            break
        notify_mention(mention, actor)


def search_mentionable(viewer, query: str, limit: int = 8) -> dict:
    """Backs GET /api/mentions/search/?q= — combined person + org results
    for the composer's @-autocomplete dropdown."""
    query = (query or "").strip()
    if not query:
        return {"users": [], "orgs": []}

    people = (
        InvestorProfile.objects.exclude(handle__isnull=True)
        .exclude(handle="")
        .filter(Q(full_name__icontains=query) | Q(handle__icontains=query))
        .select_related("user")
    )
    if viewer is not None and viewer.is_authenticated:
        people = people.exclude(user_id=viewer.id)

    orgs = Organization.objects.filter(status=Organization.Status.LIVE).filter(
        Q(name__icontains=query) | Q(slug__icontains=query)
    )

    return {
        "users": [
            {
                "type": "user",
                "handle": p.handle,
                "name": p.full_name or p.user.email,
                "avatar": p.profile_picture.url if p.profile_picture else None,
            }
            for p in people[:limit]
        ],
        "orgs": [
            {
                "type": "org",
                "slug": o.slug,
                "name": o.name,
                "avatar": o.logo.url if o.logo else None,
            }
            for o in orgs[:limit]
        ],
    }
