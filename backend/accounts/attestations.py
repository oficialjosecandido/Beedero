"""Platform-attested facts — computed from Beedero data, displayed only with opt-in."""

from credibility.levels import credibility_level
from orgs.models import Activity, Organization, OrgMembership


def platform_attestations(profile) -> list[dict]:
    prefs = profile.merged_attestation_prefs()
    items: list[dict] = []

    if prefs.get("show_verified_badge") and profile.is_verified:
        items.append(
            {
                "kind": "verified_identity",
                "label": "Identity verified on Beedero",
                "detail": "Verified by Beedero",
            }
        )

    if prefs.get("show_memberships"):
        memberships = (
            OrgMembership.objects.filter(user_id=profile.user_id)
            .select_related("org")
            .order_by("org__name")
        )
        for membership in memberships:
            org = membership.org
            if org.status != Organization.Status.LIVE:
                continue
            level = credibility_level(org)
            items.append(
                {
                    "kind": "org_membership",
                    "label": f"{membership.get_role_display()} at {org.name}",
                    "detail": f"Org credibility level {level}" if level else "Organization member",
                    "org_slug": org.slug,
                    "org_name": org.name,
                    "org_logo": org.logo.url if org.logo else None,
                }
            )

    posts_count = Activity.objects.filter(author_id=profile.user_id, org__isnull=True).count()
    if posts_count and prefs.get("show_posts_count"):
        items.append(
            {
                "kind": "posts_count",
                "label": f"{posts_count} update{'s' if posts_count != 1 else ''} on Beedero",
                "detail": "Activity on the platform",
            }
        )

    return items
