"""Relationship timeline aggregator — bands from verified `OrgMembership`
rows and self-declared `SelfDeclaredExperience` rows, with milestones
anchored by date range (no FK — see plan §3.2)."""

from datetime import date

from orgs.models import Activity, OrgMembership, Organization

from .visibility import PersonVisibilityResolver


def _milestones_within(profile, started_on, ended_on):
    milestones = Activity.objects.filter(
        author_id=profile.user_id, org__isnull=True, kind=Activity.Kind.MILESTONES
    )
    end = ended_on
    out = []
    for activity in milestones:
        occurred_on = activity.occurred_at.date()
        if occurred_on < started_on:
            continue
        if end is not None and occurred_on > end:
            continue
        out.append(
            {
                "id": activity.id,
                "title": activity.title,
                "occurred_at": activity.occurred_at.isoformat(),
            }
        )
    return out


def person_timeline(profile, viewer) -> list[dict]:
    resolver = PersonVisibilityResolver(profile, viewer)
    if not resolver.can_see("memberships"):
        return []

    bands = []

    memberships = (
        OrgMembership.objects.filter(user_id=profile.user_id, org__status=Organization.Status.LIVE)
        .select_related("org")
        .prefetch_related("skills_used")
    )
    for membership in memberships:
        bands.append(
            {
                "org_name": membership.org.name,
                "org_slug": membership.org.slug,
                "role": membership.get_role_display(),
                "title": membership.title,
                "started_on": membership.started_on.isoformat(),
                "ended_on": membership.ended_on.isoformat() if membership.ended_on else None,
                "verified": True,
                "verified_via": "org_membership",
                "skills": [
                    {"skill": s.skill, "status": s.status} for s in membership.skills_used.all()
                ],
                "milestones": _milestones_within(profile, membership.started_on, membership.ended_on),
            }
        )

    for experience in profile.user.self_declared_experiences.all():
        bands.append(
            {
                "org_name": experience.org_name,
                "org_slug": None,
                "role": experience.role,
                "title": "",
                "started_on": experience.started_on.isoformat(),
                "ended_on": experience.ended_on.isoformat() if experience.ended_on else None,
                "verified": False,
                "verified_via": None,
                "skills": [{"skill": skill, "status": "declared"} for skill in experience.skills],
                "milestones": _milestones_within(profile, experience.started_on, experience.ended_on),
            }
        )

    bands.sort(key=lambda b: (b["started_on"], b["ended_on"] or "9999-12-31"), reverse=True)
    return bands


def aggregate_anchored_skills(profile) -> list[dict]:
    """Server-side "React — used at 2 orgs over 4 years" aggregation across
    every LIVE-org membership the person has — one source of truth, not
    recomputed client-side."""
    memberships = OrgMembership.objects.filter(
        user_id=profile.user_id, org__status=Organization.Status.LIVE
    ).prefetch_related("skills_used")

    by_skill: dict[str, dict] = {}
    for membership in memberships:
        for membership_skill in membership.skills_used.all():
            key = membership_skill.skill.lower()
            entry = by_skill.setdefault(
                key,
                {
                    "skill": membership_skill.skill,
                    "org_count": 0,
                    "days": 0,
                    "confirmed": False,
                },
            )
            entry["org_count"] += 1
            end = membership.ended_on or date.today()
            entry["days"] += (end - membership.started_on).days
            if membership_skill.status == membership_skill.Status.ORG_CONFIRMED:
                entry["confirmed"] = True

    out = []
    for entry in by_skill.values():
        out.append(
            {
                "skill": entry["skill"],
                "org_count": entry["org_count"],
                "years": round(entry["days"] / 365, 1),
                "confirmed": entry["confirmed"],
            }
        )
    out.sort(key=lambda e: e["org_count"], reverse=True)
    return out
