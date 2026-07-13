"""Single source of truth for the onboarding profile-strength meter and the
refund-eligibility checklist (doc §2/§10). The meter (WEIGHTS) motivates
completion; the checklist (REFUND_REQUIREMENTS) gates the commitment-fee
refund and is intentionally narrower — a verification badge, for instance,
counts toward the meter but is excluded from refund gating per spec.
"""

from .constants import SectionKind
from .models import Activity, OrgField

WEIGHTS = {
    "one_liner": 5,
    "logo": 5,
    "about": 15,
    "team": 20,
    "products": 15,
    "market": 15,
    "first_activity": 10,
    "verified": 15,
}

REFUND_REQUIREMENTS = ["logo", "about", "team", "products", "market"]

CHECKLIST_HINTS = {
    "logo": "Add a logo so your profile looks trustworthy.",
    "about": "Describe what you do — this is your public pitch.",
    "team": "Add the team section — it's what investors look at first.",
    "products": "List at least one product or service.",
    "market": "Explain the problem and market you're going after.",
}

_SECTION_KIND_BY_KEY = {
    "about": SectionKind.ABOUT,
    "team": SectionKind.TEAM,
    "products": SectionKind.PRODUCTS,
    "market": SectionKind.MARKET_THESIS,
}


def _section_has_fields(org, kind) -> bool:
    return OrgField.objects.filter(
        section__org=org, section__kind=kind, section__archived_at__isnull=True
    ).exists()


def _has(org, key: str) -> bool:
    if key == "one_liner":
        return bool(org.one_liner)
    if key == "logo":
        return bool(org.logo)
    if key == "verified":
        return org.is_verified
    if key == "first_activity":
        return Activity.objects.filter(org=org).exists()
    section_kind = _SECTION_KIND_BY_KEY.get(key)
    if section_kind is None:
        raise ValueError(f"Unknown completeness key: {key}")
    return _section_has_fields(org, section_kind)


def completeness(org) -> int:
    return sum(weight for key, weight in WEIGHTS.items() if _has(org, key))


def is_refund_eligible(org) -> bool:
    return all(_has(org, key) for key in REFUND_REQUIREMENTS)
