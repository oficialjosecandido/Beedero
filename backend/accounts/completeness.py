"""Profile strength meter — used for discovery ranking and to explain the
posting gate (`InvestorProfile.is_complete` only requires full_name, headline
and country; those three keys sum to the same 45 points "basics" used to be
worth, just broken out so the UI can say exactly which field is missing).
"""

from orgs.models import Activity, OrgMembership

WEIGHTS = {
    "full_name": 15,
    "headline": 15,
    "country": 15,
    "org_link": 30,
    "first_post": 25,
}

CHECKLIST_HINTS = {
    "full_name": "Add your full name.",
    "headline": "Add a headline — what do you do?",
    "country": "Set your country.",
    "org_link": "Join or create an organization on Beedero.",
    "first_post": "Share your first update from the Feed.",
}


def _has(profile, key: str) -> bool:
    if key == "full_name":
        return bool(profile.full_name)
    if key == "headline":
        return bool(profile.headline)
    if key == "country":
        return bool(profile.country)
    if key == "org_link":
        return OrgMembership.objects.filter(user_id=profile.user_id).exists()
    if key == "first_post":
        return Activity.objects.filter(author_id=profile.user_id, org__isnull=True).exists()
    raise ValueError(f"Unknown profile completeness key: {key}")


def profile_completeness(profile) -> int:
    return sum(weight for key, weight in WEIGHTS.items() if _has(profile, key))


def profile_checklist(profile) -> list[dict]:
    return [
        {"key": key, "done": _has(profile, key), "hint": CHECKLIST_HINTS[key], "weight": WEIGHTS[key]}
        for key in WEIGHTS
    ]
