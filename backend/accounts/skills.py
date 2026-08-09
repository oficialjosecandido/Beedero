"""Skill list normalization — trim, dedupe case-insensitively, cap length
and count. Shared by the free skills cloud (InvestorProfile.skills),
self-declared experience skills, and anchored membership skills."""

MAX_SKILL_LENGTH = 40
MAX_SKILLS = 30


def normalize_skills(raw: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in raw:
        value = str(value).strip()[:MAX_SKILL_LENGTH]
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            out.append(value)
    return out[:MAX_SKILLS]
