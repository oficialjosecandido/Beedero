"""Private profile strength + presence for the authenticated person."""

from .badge import person_badge_state
from .completeness import profile_checklist, profile_completeness
from .presence import person_presence_signals


def person_vitality_state(profile) -> dict:
    checklist = profile_checklist(profile)
    done_count = sum(1 for item in checklist if item["done"])
    completeness = profile_completeness(profile)
    return {
        "completeness": completeness,
        "checklist": checklist,
        "done_count": done_count,
        "total_count": len(checklist),
        "presence": person_presence_signals(profile.user),
        "badge": person_badge_state(profile),
    }
