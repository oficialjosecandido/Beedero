"""Profile strength meter — used for discovery ranking and to explain the
posting gate (`InvestorProfile.is_complete` only requires full_name, headline
and country; those three keys sum to the same 45 points "basics" used to be
worth, just broken out so the UI can say exactly which field is missing).

`WEIGHTS` is a ranking input, not a verification ladder: nothing in it is
confirmed by anybody. What another party attested lives in accounts/ladder.py
and the weekly-post duty in accounts/cadence.py; `profile_completion` below is
the third of those three, the plain "fill in your profile" list, and it is
scored by count rather than by `WEIGHTS` so that changing the copy here can
never move anyone's search position.
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


# The self-declared half of a profile — what the person types about themselves.
# Neither `org_link` nor `first_post` belongs here: one is a membership fact
# and the other a cadence fact, and both have their own card.
COMPLETION_FIELDS = [
    ("full_name", "Full name", "Add your full name."),
    ("headline", "Headline", "One line: what do you do?"),
    ("country", "Country", "Set your country."),
    ("city", "Base city", "Say where you are based — it is how people nearby find you."),
    ("profile_picture", "Profile photo", "Add a photo. Profiles with one get opened more."),
    ("bio", "Bio", "Two or three lines about your work."),
    ("skills", "Skills", "List the skills you want to be found for."),
    ("links", "Links", "Add your site, or any public profile of your work."),
]


def _is_filled(profile, key: str) -> bool:
    value = getattr(profile, key)
    if key == "profile_picture":
        return bool(value)
    if key in {"skills", "links"}:
        return bool(value)
    return bool(str(value).strip())


def profile_completion(profile) -> dict:
    items = [
        {"key": key, "label": label, "hint": hint, "done": _is_filled(profile, key)}
        for key, label, hint in COMPLETION_FIELDS
    ]
    done_count = sum(1 for item in items if item["done"])
    return {
        "items": items,
        "done_count": done_count,
        "total_count": len(items),
        "percent": round(100 * done_count / len(items)),
    }
