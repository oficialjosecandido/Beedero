"""Advisor discovery — ranked by verified gig count and identity
verification, never by bio keyword matching (there's no fact behind a
keyword match, only a self-declared claim)."""

from django.db.models import Count, Q

from .models import AdvisorProfile


def find_advisors(viewer, params: dict):
    from orgs.models import OrgMembership, Organization

    qs = (
        AdvisorProfile.objects.filter(is_available=True)
        .exclude(user__investorprofile__full_name="")
        .select_related("user", "user__investorprofile")
    )
    if viewer is not None and viewer.is_authenticated:
        qs = qs.exclude(user_id=viewer.id)

    query = (params.get("q") or "").strip()
    if query:
        qs = qs.filter(
            Q(user__investorprofile__full_name__icontains=query)
            | Q(user__investorprofile__headline__icontains=query)
        )

    profiles = list(qs)

    expertise = params.get("expertise")
    if expertise:
        profiles = [p for p in profiles if expertise in p.expertise]
    stage = params.get("stage")
    if stage:
        profiles = [p for p in profiles if stage in p.stages]
    sector = params.get("sector")
    if sector:
        profiles = [p for p in profiles if sector in p.sectors]
    engagement = params.get("engagement")
    if engagement:
        profiles = [p for p in profiles if engagement in p.engagement_types]

    advisor_roles = {OrgMembership.Role.ADVISOR, OrgMembership.Role.BOARD, OrgMembership.Role.FRACTIONAL}
    gig_counts = dict(
        OrgMembership.objects.filter(
            user_id__in=[p.user_id for p in profiles],
            role__in=advisor_roles,
            org__status=Organization.Status.LIVE,
        )
        .values("user_id")
        .annotate(count=Count("id"))
        .values_list("user_id", "count")
    )

    def _advisor_score(p):
        gigs = gig_counts.get(p.user_id, 0)
        investor_profile = p.user.investorprofile
        return (-gigs, -int(investor_profile.is_verified), investor_profile.full_name.lower())

    profiles.sort(key=_advisor_score)
    return profiles, gig_counts
