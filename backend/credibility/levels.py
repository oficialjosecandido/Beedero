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


def _valid_verification_types(org) -> set[str]:
    return set(
        org.verifications.filter(status=Verification.Status.VERIFIED)
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now()))
        .values_list("type", flat=True)
    )


def credibility_level(org) -> int:
    """Levels are strictly sequential (doc §1's deliberate note): level 3
    without level 2 still reports as level 1. Level 4 is any-of, not all-of —
    Stripe, open banking, and SAF-T are alternative traction sources, not a
    checklist."""
    valid = _valid_verification_types(org)
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
