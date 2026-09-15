"""The daily deck (doc §4) — where the Beedero soul lives in the ranking.

Deliberately rule-based: verification first, local density second, overlap
third. Behavioural/ML ranking is Phase 6, and would in any case need
interaction data this module has to generate first.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.utils.timezone import now

from accounts.models import InvestorProfile
from affiliations.models import Affiliation

from .models import BuilderProfile, CofounderInterest

DAILY_LIMIT = 10  # limited on purpose: quality over an infinite scroll
CANDIDATE_POOL = 200  # scored in Python; ordering below is not expressible in SQL

# Scoring weights. Verification outranks everything else by design — on a
# Tinder the photo decides, here the credibility does (doc §2).
VERIFIED_IDENTITY_POINTS = 4
VERIFIED_TRACK_RECORD_POINTS = 2  # at least one org/registry-verified affiliation
SAME_LOCATION_POINTS = 3  # a co-founder you can have coffee with is worth more
SAME_COMMITMENT_POINTS = 2

LISBON = ZoneInfo("Europe/Lisbon")


def _deck_cache_key(user) -> str:
    return f"cofounder-deck:{user.id}:{now().astimezone(LISBON).date().isoformat()}"


def _seconds_until_tomorrow() -> int:
    """The deck is *the day's* deck, so it expires at the local day boundary
    rather than 24h after it was first built — otherwise a deck drawn at
    23:50 would still be the "today" deck most of the next day."""
    local_now = now().astimezone(LISBON)
    tomorrow = datetime.combine(local_now.date() + timedelta(days=1), time.min, tzinfo=LISBON)
    return max(60, int((tomorrow - local_now).total_seconds()))


def _identity_verified(profile: InvestorProfile | None) -> bool:
    return bool(profile and profile.is_verified)


def _score(candidate: BuilderProfile, me: BuilderProfile, verified_track_record: set[int]) -> tuple:
    candidate_profile = getattr(candidate.user, "investorprofile", None)
    my_profile = getattr(me.user, "investorprofile", None)

    score = 0
    if _identity_verified(candidate_profile):
        score += VERIFIED_IDENTITY_POINTS
    if candidate.user_id in verified_track_record:
        score += VERIFIED_TRACK_RECORD_POINTS
    # Location comes from the personal profile (country is the finest
    # granularity it carries today — city would sharpen "coffee in Lisbon",
    # and is the natural upgrade once the profile has one).
    if my_profile and candidate_profile and my_profile.country:
        if my_profile.country == candidate_profile.country:
            score += SAME_LOCATION_POINTS
    score += len(set(me.sectors or []) & set(candidate.sectors or []))
    if candidate.commitment and candidate.commitment == me.commitment:
        score += SAME_COMMITMENT_POINTS

    # Ties break towards the profile edited most recently — a live profile is
    # a better use of one of the ten slots than a dormant one.
    return (-score, -candidate.updated_at.timestamp())


def _eligible_candidates(user, me: BuilderProfile):
    """Complementarity both ways: they bring what I'm looking for, and they're
    looking for what I bring. A deck of people who'd never say yes is worse
    than a short deck."""
    from messaging.models import UserBlock

    decided = list(
        CofounderInterest.objects.filter(actor=user).values_list("target_id", flat=True)
    )
    blocked = list(
        UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True)
    ) + list(UserBlock.objects.filter(blocked=user).values_list("blocker_id", flat=True))

    qs = (
        BuilderProfile.objects.filter(is_active=True)
        .exclude(user_id__in=[*decided, *blocked, user.id])
        .select_related("user", "user__investorprofile")
    )
    if me.looking_for:
        qs = qs.filter(primary_strength__in=me.looking_for)

    candidates = [c for c in qs.order_by("-updated_at")[:CANDIDATE_POOL] if c.is_complete]
    if me.primary_strength:
        candidates = [c for c in candidates if me.primary_strength in (c.looking_for or [])]
    return candidates


def build_deck(user) -> list[BuilderProfile]:
    """Today's ranked candidates, ignoring the cache."""
    me = getattr(user, "builder", None)
    if me is None or not me.is_active or not me.is_complete:
        return []

    candidates = _eligible_candidates(user, me)
    verified_track_record = set(
        Affiliation.objects.filter(
            user_id__in=[c.user_id for c in candidates], status=Affiliation.Status.VERIFIED
        ).values_list("user_id", flat=True)
    )
    candidates.sort(key=lambda c: _score(c, me, verified_track_record))
    return candidates[:DAILY_LIMIT]


def daily_deck(user) -> list[BuilderProfile]:
    """The day's deck, stable within the day (doc §4): coming back later shows
    the same cards, and a new deck is drawn tomorrow. Only the *ids* are
    cached — the rows are re-read every time, so a card whose owner opted out,
    blocked the viewer, or was already decided on drops out immediately
    instead of lingering in a stale cache."""
    key = _deck_cache_key(user)
    cached_ids = cache.get(key)
    if cached_ids is None:
        deck = build_deck(user)
        cache.set(key, [p.user_id for p in deck], timeout=_seconds_until_tomorrow())
        return deck

    if not cached_ids:
        return []

    from messaging.models import UserBlock

    decided = set(CofounderInterest.objects.filter(actor=user).values_list("target_id", flat=True))
    blocked = set(
        UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True)
    ) | set(UserBlock.objects.filter(blocked=user).values_list("blocker_id", flat=True))

    rows = {
        p.user_id: p
        for p in BuilderProfile.objects.filter(
            user_id__in=cached_ids, is_active=True
        ).select_related("user", "user__investorprofile")
    }
    return [
        rows[user_id]
        for user_id in cached_ids
        if user_id in rows and user_id not in decided and user_id not in blocked
    ]


def invalidate_deck(user) -> None:
    cache.delete(_deck_cache_key(user))
