"""Public person profile — respects visibility; never leaks private sections."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils.timezone import now

from advisory.models import AdvisorProfile
from analytics.models import PersonProfileView
from connections import services as connections_services
from orgs.models import Activity

from social.mentions import resolve_mentions

from .attestations import platform_attestations
from .models import InvestorProfile
from .timeline import aggregate_anchored_skills, person_timeline
from .visibility import PersonVisibilityResolver

PROFILE_VIEW_DEDUPE_HOURS = 24


def _record_view(subject, viewer):
    if viewer is None or not viewer.is_authenticated or viewer.id == subject.id:
        return
    since = now() - timedelta(hours=PROFILE_VIEW_DEDUPE_HOURS)
    if PersonProfileView.objects.filter(subject=subject, viewer=viewer, viewed_at__gte=since).exists():
        return
    PersonProfileView.objects.create(subject=subject, viewer=viewer)


def public_person_profile(handle: str, viewer) -> dict:
    profile = get_object_or_404(
        InvestorProfile.objects.select_related("user"),
        handle=handle,
    )
    if not profile.is_complete:
        from django.http import Http404

        raise Http404()

    _record_view(profile.user, viewer)
    resolver = PersonVisibilityResolver(profile, viewer)

    person = {
        "handle": profile.handle,
        "full_name": profile.full_name,
        "headline": profile.headline,
        "is_verified": profile.is_verified,
        "profile_picture": profile.profile_picture.url if profile.profile_picture else None,
    }
    if resolver.can_see("bio") and profile.bio:
        person["bio"] = profile.bio
    if resolver.can_see("bio") and profile.manifesto:
        person["manifesto"] = profile.manifesto
    if resolver.can_see("bio") and profile.links:
        person["links"] = profile.links
    if resolver.can_see("country") and profile.country:
        person["country"] = profile.country

    attestations = platform_attestations(profile) if resolver.can_see("attestations") else []

    posts = []
    if resolver.can_see("posts"):
        for activity in Activity.objects.filter(author_id=profile.user_id, org__isnull=True).order_by(
            "-occurred_at"
        )[:20]:
            posts.append(
                {
                    "id": activity.id,
                    "kind": activity.kind,
                    "title": activity.title,
                    "body": activity.body,
                    "mentions": resolve_mentions(activity.body),
                    "occurred_at": activity.occurred_at.isoformat(),
                }
            )

    payload = {
        "person": person,
        "attestations": attestations,
        "posts": posts,
        "timeline": person_timeline(profile, viewer),
    }
    if resolver.can_see("skills"):
        payload["skills"] = {
            "free": profile.skills,
            "aggregated": aggregate_anchored_skills(profile),
        }

    advisor_profile = AdvisorProfile.objects.filter(user_id=profile.user_id).first()
    if advisor_profile:
        payload["advisor"] = {
            "is_available": advisor_profile.is_available,
            "expertise": advisor_profile.expertise,
            "stages": advisor_profile.stages,
            "sectors": advisor_profile.sectors,
            "engagement_types": advisor_profile.engagement_types,
        }

    if viewer and viewer.is_authenticated and viewer.id != profile.user_id:
        payload["viewer_actions"] = {
            "can_message": connections_services.can_message_directly(viewer, profile.user),
            "connection_status": connections_services.connection_status(viewer, profile.user),
            "user_id": profile.user_id,
        }
    return payload
