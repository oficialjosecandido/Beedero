from rest_framework import serializers

from orgs.serializers import _org_summary

from .models import Affiliation, RoleType


class AffiliationDeclareSerializer(serializers.Serializer):
    org_slug = serializers.SlugField()
    role = serializers.ChoiceField(choices=RoleType.choices)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    started_on = serializers.DateField()
    ended_on = serializers.DateField(required=False, allow_null=True, default=None)
    skills = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class AffiliationAddSerializer(serializers.Serializer):
    handle = serializers.SlugField()
    role = serializers.ChoiceField(choices=RoleType.choices)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    started_on = serializers.DateField()
    ended_on = serializers.DateField(required=False, allow_null=True, default=None)


def _person_summary(user) -> dict:
    profile = getattr(user, "investorprofile", None)
    return {
        "id": user.id,
        "name": profile.full_name if profile else user.email.split("@", 1)[0],
        "headline": profile.headline if profile else "",
        "handle": profile.handle if profile else "",
        "is_verified": bool(profile and profile.is_verified),
        "profile_picture": profile.profile_picture.url if profile and profile.profile_picture else None,
    }


def affiliation_summary(affiliation: Affiliation) -> dict:
    return {
        "id": affiliation.id,
        "org": _org_summary(affiliation.org),
        "person": _person_summary(affiliation.user),
        "role": affiliation.role,
        "title": affiliation.title,
        "started_on": affiliation.started_on.isoformat(),
        "ended_on": affiliation.ended_on.isoformat() if affiliation.ended_on else None,
        "skills": affiliation.skills,
        "status": affiliation.status,
        "verified_via": affiliation.verified_via or None,
        "verified_at": affiliation.verified_at.isoformat() if affiliation.verified_at else None,
        "is_org_added": affiliation.created_by_id != affiliation.user_id,
        "created_at": affiliation.created_at.isoformat(),
    }
