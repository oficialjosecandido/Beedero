from rest_framework import serializers

from accounts.attestations import platform_attestations
from accounts.models import InvestorProfile

from .models import ConnectionRequest, OrgConnectionRequest
from .services import reputation_tier


def _investor_profile(user):
    try:
        return user.investorprofile
    except InvestorProfile.DoesNotExist:
        return None


def _display_name(user):
    profile = _investor_profile(user)
    return (profile.full_name if profile and profile.full_name else None) or user.email


def _profile_picture(user):
    profile = _investor_profile(user)
    if not profile or not profile.profile_picture:
        return None
    try:
        return profile.profile_picture.url
    except Exception:
        return None


def _requester_summary(user) -> dict:
    profile = _investor_profile(user)
    return {
        "id": user.id,
        "name": _display_name(user),
        "handle": profile.handle if profile else None,
        "headline": profile.headline if profile else "",
        "profile_picture": _profile_picture(user),
        "reputation_tier": reputation_tier(user),
        "attestations": platform_attestations(profile) if profile else [],
    }


class SendConnectionRequestSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class SendOrgConnectionRequestSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class SendOrgOutreachSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


def connection_request_summary(req: ConnectionRequest) -> dict:
    return {
        "id": req.id,
        "requester": _requester_summary(req.requester),
        "note": req.note,
        "status": req.status,
        "created_at": req.created_at.isoformat(),
    }


def org_connection_request_summary(req: OrgConnectionRequest) -> dict:
    return {
        "id": req.id,
        "org": {"id": req.org_id, "slug": req.org.slug, "name": req.org.name},
        "requester": _requester_summary(req.requester),
        "initiated_by": req.initiated_by,
        "note": req.note,
        "status": req.status,
        "created_at": req.created_at.isoformat(),
    }
