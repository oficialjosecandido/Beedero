"""Progressive posting gates by credibility level — amplifier, not gatekeeper."""

from credibility.levels import credibility_level

from .constants import ALL_POST_KINDS, LOCK_MESSAGES, PostKind, UNLOCK_LEVEL

POSTING_RULES = {
    0: {"kinds": {PostKind.UPDATE}, "min_days_between": 3},
    1: {"kinds": {PostKind.UPDATE, PostKind.MILESTONE}, "min_days_between": 1},
    2: {"kinds": {PostKind.UPDATE, PostKind.MILESTONE, PostKind.EVENT}, "min_days_between": 1},
    3: {"kinds": ALL_POST_KINDS, "min_days_between": 1},
    4: {"kinds": ALL_POST_KINDS, "min_days_between": 1},
}


def posting_rule(org) -> dict:
    level = credibility_level(org)
    bucket = 4 if level >= 4 else min(level, 3)
    return POSTING_RULES[bucket]


def locked_kinds(org) -> list[dict]:
    rule = posting_rule(org)
    locked = []
    for kind in PostKind.values:
        if kind in rule["kinds"]:
            continue
        locked.append(
            {
                "kind": kind,
                "unlocks_at_level": UNLOCK_LEVEL[kind],
                "reason": LOCK_MESSAGES.get(kind, "Not available at your credibility level."),
            }
        )
    return locked
