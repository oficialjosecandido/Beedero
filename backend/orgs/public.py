"""Public path — separated by construction (§3.4).

Unauthenticated, has no knowledge of grants or restricted/private fields. It
can only, by code, touch `visibility=public`. It's physically impossible to
leak here because the `PUBLIC` filter is written into the query itself, it
doesn't depend on any runtime decision.
"""

from collections import defaultdict

from django.shortcuts import get_object_or_404

from .models import OrgField, Organization, Visibility


def public_profile(slug: str) -> dict:
    from credibility.levels import credibility_level

    from .posting.freshness import freshness_label
    from .posting.services import upcoming_events

    org = get_object_or_404(Organization, slug=slug, status=Organization.Status.LIVE)
    fields = OrgField.objects.filter(
        section__org=org,
        section__archived_at__isnull=True,
        visibility=Visibility.PUBLIC,  # and nothing else, ever
    ).select_related("section")

    sections = defaultdict(dict)
    for f in fields:
        sections[f.section.kind][f.key] = f.value

    return {
        "org": {
            "slug": org.slug,
            "name": org.name,
            "one_liner": org.one_liner,
            "logo": org.logo.url if org.logo else None,
            "is_verified": org.is_verified,
            "is_fundraising": org.is_fundraising,
            "credibility_level": credibility_level(org),
            "freshness": freshness_label(org),
        },
        "sections": sections,
        "upcoming_events": upcoming_events(org),
    }
