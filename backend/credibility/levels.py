"""Single source of truth for the credibility ladder's level number (doc §1).

The level is always derived from live `Verification` rows, never stored —
an expired certificate silently drops the org back a level with nothing to
clean up.
"""

from django.db.models import Q
from django.utils.timezone import now

from .models import Verification, VerificationType

LEVEL_REQUIREMENTS = {
    1: {VerificationType.COMPANY_REGISTRY, VerificationType.FOUNDER_ROLE},
    2: {VerificationType.TAX_CLEARANCE, VerificationType.SS_CLEARANCE},
    3: {VerificationType.ANNUAL_ACCOUNTS},
}
LEVEL_4_ANY_OF = {
    VerificationType.STRIPE_TRACTION,
    VerificationType.OPEN_BANKING,
    VerificationType.SAFT_EFATURA,
}

# Where `prime_credibility_levels` leaves its answer. Reading it back from the
# instance is what makes `credibility_level(org)` free in a primed loop.
_PRIMED_ATTR = "_credibility_level"


def _valid_verification_types(org) -> set[str]:
    return set(
        org.verifications.filter(status=Verification.Status.VERIFIED)
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now()))
        .values_list("type", flat=True)
    )


def _level_from(valid: set[str]) -> int:
    """Levels are strictly sequential (doc §1's deliberate note): level 3
    without level 2 still reports as level 1. Level 4 is any-of, not all-of —
    Stripe, open banking, and SAF-T are alternative traction sources, not a
    checklist."""
    level = 0
    if LEVEL_REQUIREMENTS[1] <= valid:
        level = 1
        if LEVEL_REQUIREMENTS[2] <= valid:
            level = 2
            if LEVEL_REQUIREMENTS[3] <= valid:
                level = 3
                if valid & LEVEL_4_ANY_OF:
                    level = 4
    return level


def credibility_level(org) -> int:
    """The org's level. One query, unless `prime_credibility_levels` already
    answered for this instance."""
    primed = getattr(org, _PRIMED_ATTR, None)
    if primed is not None:
        return primed
    return _level_from(_valid_verification_types(org))


def credibility_levels(org_ids) -> dict[int, int]:
    """Levels for many orgs in a single query.

    The per-org function is one query each, which is fine on a profile page
    and ruinous in a list: discovery ranks up to 500 candidates, and the
    directory and every serializer that embeds an org summary pay the same
    cost per row. Shape is `{org_id: level}`, and an id with no verifications
    still gets an entry (level 0) so callers never have to special-case a
    missing key.
    """
    ids = list(dict.fromkeys(org_ids))
    if not ids:
        return {}

    valid_by_org: dict[int, set[str]] = {org_id: set() for org_id in ids}
    rows = (
        Verification.objects.filter(org_id__in=ids, status=Verification.Status.VERIFIED)
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now()))
        .values_list("org_id", "type")
    )
    for org_id, type_ in rows:
        valid_by_org[org_id].add(type_)

    return {org_id: _level_from(valid) for org_id, valid in valid_by_org.items()}


def prime_credibility_levels(orgs) -> list:
    """Resolve every org's level in one query and cache it on the instances.

    Same idea as `prefetch_related`, for a value that is computed rather than
    joined: afterwards `credibility_level(org)` — and anything that calls it,
    like `discovery_score` or `_org_summary` — costs nothing. Returns the
    orgs so it can wrap a list in place.

    Only ever called on a list that is already in memory, which keeps the
    single query bounded by what the caller fetched. Priming a queryset would
    evaluate it twice.
    """
    orgs = list(orgs)
    levels = credibility_levels(org.id for org in orgs)
    for org in orgs:
        setattr(org, _PRIMED_ATTR, levels.get(org.id, 0))
    return orgs
