"""Platform-attested facts — computed from Beedero data, displayed only with opt-in."""

from credibility.levels import credibility_level
from orgs.models import Activity, Organization, OrgMembership


def _org_logo_url(org) -> str | None:
    if not org.logo:
        return None
    try:
        return org.logo.url
    except ValueError:
        return None


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
            if org.status not in (Organization.Status.LIVE, Organization.Status.DRAFT):
                continue
            role_label = membership.title or membership.get_role_display()
            if org.status == Organization.Status.LIVE:
                level = credibility_level(org)
                detail = (
                    f"Verified by {org.name} · credibility level {level}"
                    if level
                    else f"Verified by {org.name}"
                )
            else:
                detail = f"Verified by {org.name} (organisation not published yet)"
            items.append(
                {
                    "kind": "org_membership",
                    "label": f"{role_label} at {org.name}",
                    "detail": detail,
                    # Only link when the public org page exists.
                    "org_slug": org.slug if org.status == Organization.Status.LIVE else None,
                    "org_name": org.name,
                    "org_logo": _org_logo_url(org),
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
