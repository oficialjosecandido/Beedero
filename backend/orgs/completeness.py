"""Single source of truth for the onboarding profile-strength meter and the
refund-eligibility checklist (doc §2/§10). The meter (WEIGHTS) motivates
completion; the checklist (REFUND_REQUIREMENTS) gates the commitment-fee
refund and is intentionally narrower — a verification badge, for instance,
counts toward the meter but is excluded from refund gating per spec.

The last 10 points of the meter ("activity") are not sticky: they require a
post within the last ACTIVITY_WINDOW_DAYS days, so a fully-filled-out profile
that goes quiet drops from 100% to 90% until it posts again.
"""

from datetime import timedelta

from django.utils.timezone import now

from .constants import SectionKind
from .models import Activity, OrgField, OrgMembership

ACTIVITY_WINDOW_DAYS = 7

WEIGHTS = {
    "one_liner": 5,
    "logo": 5,
    "stage": 5,
    "sector": 5,
    "geo": 5,
    "about": 15,
    "team": 20,
    "products": 15,
    "market": 15,
    "activity": 10,
}

REFUND_REQUIREMENTS = ["logo", "about", "team", "products", "market"]

# Gates the Overview "Publish organization" action. Market thesis stays optional.
ACTIVATION_REQUIREMENTS = [
    "logo",
    "one_liner",
    "stage",
    "sector",
    "geo",
    "about",
    "team",
    "products",
]

CHECKLIST_HINTS = {
    "logo": "Add a logo so your profile looks trustworthy.",
    "one_liner": "Add a one-liner in Profile.",
    "stage": "Select your stage in Profile.",
    "sector": "Select your sector in Profile.",
    "geo": "Where is your HQ and main team based? Set this in Profile.",
    "about": "Fill in summary, mission, vision, and values in Profile.",
    "team": "Add team members in Profile — it's what investors look at first.",
    "products": "List at least one product or service.",
    "market": "Explain the problem and market you're going after.",
    "activity": f"Post an update at least once every {ACTIVITY_WINDOW_DAYS} days to keep your profile strength at 100%.",
}

# Overview checklist — profile setup, plus staying active. Credibility is a separate product.
PROFILE_STRENGTH_CHECKLIST = [
    *ACTIVATION_REQUIREMENTS,
    "market",
    "activity",
]


def profile_strength_checklist(org) -> list[dict]:
    return [
        {
            "key": key,
            "done": _has(org, key),
            "hint": CHECKLIST_HINTS[key],
            "weight": WEIGHTS.get(key, 0),
        }
        for key in PROFILE_STRENGTH_CHECKLIST
    ]


def has_recent_activity(org) -> bool:
    return Activity.objects.filter(
        org=org, created_at__gte=now() - timedelta(days=ACTIVITY_WINDOW_DAYS)
    ).exists()

_SECTION_KIND_BY_KEY = {
    "about": SectionKind.ABOUT,
    "products": SectionKind.PRODUCTS,
    "market": SectionKind.MARKET_THESIS,
}

ABOUT_REQUIRED_KEYS = frozenset({"summary", "mission", "vision", "values"})


def about_complete(org) -> bool:
    keys = OrgField.objects.filter(
        section__org=org,
        section__kind=SectionKind.ABOUT,
        section__archived_at__isnull=True,
    ).values_list("key", flat=True)
    return ABOUT_REQUIRED_KEYS.issubset(set(keys))


def _section_has_fields(org, kind) -> bool:
    return OrgField.objects.filter(
        section__org=org, section__kind=kind, section__archived_at__isnull=True
    ).exists()


def _has(org, key: str) -> bool:
    if key == "activity":
        return has_recent_activity(org)
    if key == "one_liner":
        return bool(org.one_liner)
    if key == "stage":
        return bool(org.stage)
    if key == "sector":
        return bool(org.sector)
    if key == "geo":
        return bool(org.geo)
    if key == "logo":
        return bool(org.logo)
    if key == "team":
        return OrgMembership.objects.filter(org=org).exists()
    section_kind = _SECTION_KIND_BY_KEY.get(key)
    if section_kind is None:
        raise ValueError(f"Unknown completeness key: {key}")
    if key == "about":
        return about_complete(org)
    return _section_has_fields(org, section_kind)


def completeness(org) -> int:
    return sum(weight for key, weight in WEIGHTS.items() if _has(org, key))


def is_refund_eligible(org) -> bool:
    return all(_has(org, key) for key in REFUND_REQUIREMENTS)


def is_publish_ready(org) -> bool:
    return all(_has(org, key) for key in ACTIVATION_REQUIREMENTS)
