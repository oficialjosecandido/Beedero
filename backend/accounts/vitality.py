"""Private profile strength + presence for the authenticated person.

Three separate ideas, deliberately not merged into one list:

  `ladder`     — what somebody else confirmed (accounts/ladder.py). Only goes up.
  `cadence`    — the weekly posting duty, as a streak (accounts/cadence.py).
  `completion` — the self-declared fields (accounts/completeness.py).

`completeness`/`checklist` stay as they were: they are the ranking input and
the posting-gate explanation, and the onboarding wizard reads them.
"""

from .badge import person_badge_state
from .cadence import posting_cadence
from .completeness import profile_checklist, profile_completeness, profile_completion
from .ladder import verification_ladder
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
        "ladder": verification_ladder(profile),
        "cadence": posting_cadence(profile.user),
        "completion": profile_completion(profile),
        "presence": person_presence_signals(profile.user),
        "badge": person_badge_state(profile),
    }
