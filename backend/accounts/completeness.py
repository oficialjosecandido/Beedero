"""Profile strength meter — private checklist, used for discovery ranking only."""

from orgs.models import Activity, OrgMembership

WEIGHTS = {
    "basics": 30,
    "handle": 20,
    "verified": 25,
    "org_link": 15,
    "first_post": 10,
}

CHECKLIST_HINTS = {
    "basics": "Add your name, headline, and country.",
    "handle": "Choose a public handle for your shareable profile.",
    "verified": "Complete identity verification (admin-reviewed at launch).",
    "org_link": "Join or create an organization on Beedero.",
    "first_post": "Share your first update from the Feed.",
}


def _has(profile, key: str) -> bool:
    if key == "basics":
        return profile.is_complete
    if key == "handle":
        return profile.has_public_handle
    if key == "verified":
        return profile.is_verified
    if key == "org_link":
        return OrgMembership.objects.filter(user_id=profile.user_id).exists()
    if key == "first_post":
        return Activity.objects.filter(author_id=profile.user_id, org__isnull=True).exists()
    raise ValueError(f"Unknown profile completeness key: {key}")


def profile_completeness(profile) -> int:
    return sum(weight for key, weight in WEIGHTS.items() if _has(profile, key))


def profile_checklist(profile) -> list[dict]:
    return [
        {"key": key, "done": _has(profile, key), "hint": CHECKLIST_HINTS[key]}
        for key in WEIGHTS
    ]
