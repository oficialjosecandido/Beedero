"""Co-founder matching writes. Mirrors connections/services.py's convention:
plain functions, @transaction.atomic on the ones that write more than a row,
DRF exceptions for anything the caller should see as a 4xx.
"""

import logging

from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from beedero.ratelimit import enforce_rate_limit
from messaging.services import get_or_create_conversation, is_blocked
from notifications.models import Notification
from notifications.services import notify

from .models import BuilderProfile, CofounderInterest, CofounderMatch
from .recommendations import DAILY_LIMIT, invalidate_deck

logger = logging.getLogger(__name__)

# A deck is 10 cards a day; the cap is well above that so deciding on
# yesterday's cards or changing one's mind is never blocked, while scripted
# mass-liking (the thing that makes these products feel like a casino) is.
INTERESTS_PER_DAY = DAILY_LIMIT * 4

# Doc §10: a matcher without critical mass matches nobody, and an empty
# feature reads worse than an absent one. This is the promotion gate, not a
# build gate — the module works below it, it just doesn't advertise itself.
DENSITY_GATE = 150
DENSITY_CACHE_SECONDS = 15 * 60


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]


def get_or_create_profile(user) -> BuilderProfile:
    profile, _ = BuilderProfile.objects.get_or_create(user=user)
    return profile


def active_builder_count(country: str = "") -> int:
    """Active builders in a market. Cached: it's only ever read against a
    coarse threshold, so a quarter-hour of staleness costs nothing and keeps
    it off the hot path of every page render."""
    key = f"cofounder-active-builders:{country or 'all'}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    qs = BuilderProfile.objects.filter(is_active=True)
    if country:
        qs = qs.filter(user__investorprofile__country=country)
    count = qs.count()
    cache.set(key, count, timeout=DENSITY_CACHE_SECONDS)
    return count


def bust_density_cache(user=None) -> None:
    """Called when someone opts in or out, so the gate reflects the person who
    just joined instead of making them wait out the TTL. Clears the
    platform-wide count and, when known, their own market's."""
    keys = ["cofounder-active-builders:all"]
    profile = getattr(user, "investorprofile", None) if user else None
    if profile and profile.country:
        keys.append(f"cofounder-active-builders:{profile.country}")
    cache.delete_many(keys)


def density_status(user) -> dict:
    """The viewer's own market is their declared country — the unit the gate
    is expressed in ("≥150 builders in a market"). With no country declared
    there is no market to measure, so the platform-wide count stands in."""
    profile = getattr(user, "investorprofile", None)
    country = profile.country if profile and profile.country else ""
    count = active_builder_count(country)
    return {
        "market": country,
        "active_builders": count,
        "threshold": DENSITY_GATE,
        "gate_met": count >= DENSITY_GATE,
    }


def activate_profile(profile: BuilderProfile) -> None:
    """Opting in is only meaningful once there's a card worth showing and the
    18+ confirmation is on record (doc §7)."""
    if not profile.adult_confirmed:
        raise ValidationError(
            {"adult_confirmed": "You must confirm you're 18 or over to use co-founder matching."}
        )
    if not profile.is_complete:
        raise ValidationError(
            {
                "is_active": (
                    "Add your main strength, what you're looking for, and your commitment "
                    "level before going live."
                )
            }
        )


@transaction.atomic
def record_interest(actor, target, liked: bool):
    """Returns (interest, match_or_None). A match exists only when both sides
    said yes — never on one-sided interest, and never as a side effect of
    anything else."""
    if actor.id == target.id:
        raise ValidationError({"target_id": "You can't express interest in yourself."})

    me = getattr(actor, "builder", None)
    if me is None or not me.is_active:
        raise PermissionDenied("Turn on co-founder matching before deciding on other builders.")

    their_profile = BuilderProfile.objects.filter(user=target, is_active=True).first()
    if their_profile is None:
        # Not 404: the viewer legitimately saw this card, it just went away.
        raise ValidationError({"target_id": "This builder is no longer looking for a co-founder."})

    if is_blocked(actor, target):
        raise PermissionDenied("You can't contact this user.")

    enforce_rate_limit(
        f"cofounder-interest:{actor.id}", limit=INTERESTS_PER_DAY, window_seconds=86400
    )

    # update_or_create, not get_or_create: a pass is reversible. Deciding is a
    # considered choice here, and a considered choice can be reconsidered
    # (the rate limit above is what stops that becoming mass-liking).
    interest, _ = CofounderInterest.objects.update_or_create(
        actor=actor, target=target, defaults={"liked": liked}
    )
    if not liked:
        return interest, None

    reciprocal = CofounderInterest.objects.filter(actor=target, target=actor, liked=True).exists()
    if not reciprocal:
        return interest, None

    return interest, _create_match(actor, target)


def _create_match(actor, target) -> CofounderMatch:
    first, second = sorted([actor, target], key=lambda u: u.id)
    # The check above is check-then-create, so two simultaneous mutual
    # interests can both reach here. The nested atomic gives the INSERT its
    # own savepoint (same pattern as connections.services.send_request) so a
    # uniq_cofounder_match collision only unwinds this insert.
    try:
        with transaction.atomic():
            match = CofounderMatch.objects.create(user_a=first, user_b=second)
    except IntegrityError:
        logger.warning("Duplicate cofounder match race: %s / %s", first.id, second.id)
        return CofounderMatch.objects.get(user_a=first, user_b=second)

    # Mutual acceptance is what opens a conversation everywhere on Beedero —
    # so the match opens the ordinary DM thread rather than a private one.
    match.conversation = get_or_create_conversation(actor, target)
    match.save(update_fields=["conversation", "updated_at"])

    for recipient, other in ((actor, target), (target, actor)):
        notify(
            recipient,
            kind=Notification.Kind.COFOUNDER_MATCH,
            aggregate_key=f"cofounder_match:{match.id}:{recipient.id}",
            title="It's a match",
            body=f"You and {_display_name(other)} are both interested in building together.",
            link="/cofounder?tab=matches",
        )

    invalidate_deck(actor)
    invalidate_deck(target)
    return match


def matches_for(user):
    from django.db.models import Q

    return (
        CofounderMatch.objects.filter(Q(user_a=user) | Q(user_b=user))
        .select_related(
            "user_a__investorprofile",
            "user_b__investorprofile",
            "user_a__builder",
            "user_b__builder",
            "org",
        )
        .order_by("-created_at")
    )


def get_match_or_404(user, match_id: int) -> CofounderMatch:
    """404 rather than 403 for a match the viewer isn't part of — the same
    anti-enumeration rule as messaging.get_visible_conversation_or_404."""
    from django.http import Http404

    match = CofounderMatch.objects.filter(pk=match_id).first()
    if match is None or user.id not in (match.user_a_id, match.user_b_id):
        raise Http404
    return match


def set_outcome(match: CofounderMatch, outcome: str) -> CofounderMatch:
    """Either party records where the match went. formed_org is not settable
    by hand — it's only ever written by create_org_from_match, so the mother
    metric can't be inflated by a button."""
    if outcome == CofounderMatch.Outcome.FORMED_ORG:
        raise ValidationError(
            {"outcome": "Use the create-org action — this outcome records a real organization."}
        )
    if outcome not in CofounderMatch.Outcome.values:
        raise ValidationError({"outcome": "Unknown outcome."})
    match.outcome = outcome
    match.save(update_fields=["outcome", "updated_at"])
    return match


@transaction.atomic
def create_org_from_match(match: CofounderMatch, by, name: str, one_liner: str = ""):
    """Closes the funnel (doc §6): the match becomes a real organization here,
    with both people as founders. Returns (org, invite).

    The other founder is invited as an owner rather than silently inserted as
    a member — consent is the whole point of this platform, and the existing
    invite flow already handles accept/expire/revoke. The match is marked
    formed_org at creation: the org exists and came from this match, which is
    what the metric asks.
    """
    from orgs.models import OrgFollow, OrgInvite, OrgMembership, Organization
    # Lives in orgs.views (its only caller until now); imported here rather
    # than reimplemented so the slug rule has one definition.
    from orgs.views import unique_org_slug

    if by.id not in (match.user_a_id, match.user_b_id):
        raise PermissionDenied("Only the two people in this match can do that.")
    if match.org_id is not None:
        raise ValidationError({"name": "You've already created an organization from this match."})

    name = (name or "").strip()
    if not name:
        raise ValidationError({"name": "Name is required."})

    other = match.other_user(by)
    if is_blocked(by, other):
        raise PermissionDenied("You can't contact this user.")

    enforce_rate_limit(f"create_org:user:{by.id}", limit=5, window_seconds=3600)

    org = None
    for _attempt in range(5):
        try:
            with transaction.atomic():
                org = Organization.objects.create(
                    slug=unique_org_slug(name), name=name, one_liner=(one_liner or "").strip()[:140]
                )
            break
        except IntegrityError:
            continue
    if org is None:
        raise ValidationError({"name": "Could not create the organization, please try again."})

    OrgMembership.objects.create(org=org, user=by, role=OrgMembership.Role.OWNER)
    OrgFollow.objects.get_or_create(user=by, org=org)
    invite = OrgInvite.objects.create(
        org=org, role=OrgMembership.Role.OWNER, created_by=by, max_uses=1
    )

    match.org = org
    match.outcome = CofounderMatch.Outcome.FORMED_ORG
    match.save(update_fields=["org", "outcome", "updated_at"])

    notify(
        other,
        kind=Notification.Kind.COFOUNDER_MATCH,
        aggregate_key=f"cofounder_org:{match.id}",
        title=f"{_display_name(by)} started {org.name} with you",
        body="Accept the invite to join as a founder.",
        link=f"/invite/{invite.token}",
    )
    return org, invite
