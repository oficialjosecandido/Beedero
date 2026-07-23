import logging
from collections import defaultdict

from django.db import transaction
from rest_framework import serializers

from .constants import ACTIVITY_KINDS, SectionKind
from .models import (
    FundraiseRound,
    Organization,
    OrgFollow,
    OrgInvite,
    OrgMembership,
    OrgSection,
    RestrictedAccessLog,
    Visibility,
    VisibilityGrant,
)
from .visibility import VisibilityResolver

logger = logging.getLogger(__name__)


def _org_summary(org):
    from credibility.levels import credibility_level

    return {
        "slug": org.slug,
        "name": org.name,
        "one_liner": org.one_liner,
        "status": org.status,
        "stage": org.stage,
        "sector": org.sector,
        "geo": org.geo,
        "logo": org.logo.url if org.logo else None,
        "is_verified": org.is_verified,
        "is_fundraising": org.is_fundraising,
        "credibility_level": credibility_level(org),
    }


class OrgProfileSerializer:
    """Layer 3 (§3.3): the output schema is built from what the
    resolver authorized — never by trimming a complete object."""

    def __init__(self, org, resolver: VisibilityResolver, request=None):
        self.org = org
        self.resolver = resolver
        self.request = request

    def data(self) -> dict:
        fields = list(self.resolver.visible_fields().select_related("section"))
        self._log_restricted(fields)
        sections = defaultdict(dict)
        for f in fields:
            sections[f.section.kind][f.key] = f.value
        viewer = self.resolver.viewer
        viewer_is_member = self.resolver.is_member
        viewer_is_following = False
        if viewer and getattr(viewer, "is_authenticated", False):
            viewer_is_following = OrgFollow.objects.filter(user=viewer, org=self.org).exists()
        return {
            "org": _org_summary(self.org),
            "sections": sections,
            "viewer_is_following": viewer_is_following,
            "viewer_is_member": viewer_is_member,
        }

    def _log_restricted(self, fields):
        # §2.5: logs who opened which restricted field, when. Does not log
        # members viewing their own org's fields — that's not third-party access.
        viewer = self.resolver.viewer
        if not viewer or not getattr(viewer, "is_authenticated", False) or self.resolver.is_member:
            return
        ip = self.request.META.get("REMOTE_ADDR") if self.request else None
        logs = [
            RestrictedAccessLog(
                viewer=viewer, org=self.org, field_key=f.key, section_kind=f.section.kind, ip=ip
            )
            for f in fields
            if f.visibility == Visibility.RESTRICTED
        ]
        if not logs:
            return
        # A savepoint, not the request's outer transaction (opened by
        # RLSViewerMiddleware): a write failure here is a logging problem,
        # not a reason to fail the profile read that already succeeded — and
        # without the savepoint, an error here would abort the whole
        # transaction for everything else still to run in this request.
        try:
            with transaction.atomic():
                RestrictedAccessLog.objects.bulk_create(logs)
        except Exception:
            logger.exception("Failed to write restricted-access audit log for org=%s", self.org.id)


class VisibilityGrantSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisibilityGrant
        fields = [
            "id",
            "org",
            "section",
            "field",
            "principal_type",
            "principal_id",
            "granted_by",
            "granted_at",
            "expires_at",
        ]
        read_only_fields = ["org", "granted_by", "granted_at"]

    def validate(self, attrs):
        if not attrs.get("section") and not attrs.get("field"):
            raise serializers.ValidationError("The grant needs a section or a field.")
        return attrs


class FundraiseRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = FundraiseRound
        fields = [
            "id",
            "org",
            "valuation",
            "ask_amount",
            "raised_amount",
            "use_of_funds",
            "stage",
            "is_open",
            "opened_at",
            "closed_at",
        ]
        read_only_fields = ["org", "raised_amount", "is_open", "opened_at", "closed_at"]


class FeedPostSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[(k.value, k.label) for k in ACTIVITY_KINDS])
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(allow_blank=True, required=False, default="")
    occurred_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("image") and attrs.get("kind") == SectionKind.MILESTONES:
            raise serializers.ValidationError({"image": "Milestones cannot include photos."})
        ends_at = attrs.get("ends_at")
        if ends_at and attrs.get("kind") == SectionKind.EVENTS and ends_at <= attrs["occurred_at"]:
            raise serializers.ValidationError({"ends_at": "End time must be after the start time."})
        return attrs

    def create(self, org: "Organization"):
        from .services import create_activity

        section = OrgSection.objects.get(org=org, kind=self.validated_data["kind"])
        return create_activity(
            org=org,
            kind=self.validated_data["kind"],
            title=self.validated_data["title"],
            body=self.validated_data.get("body", ""),
            occurred_at=self.validated_data["occurred_at"],
            ends_at=self.validated_data.get("ends_at"),
            image=self.validated_data.get("image"),
            visibility=section.visibility,
        )


class OrgMembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = OrgMembership
        fields = ["id", "email", "full_name", "profile_picture", "role", "title"]
        read_only_fields = ["id", "email", "full_name", "profile_picture", "role"]

    def get_full_name(self, obj):
        profile = getattr(obj.user, "investorprofile", None)
        return (profile.full_name if profile and profile.full_name else None) or obj.user.email

    def get_profile_picture(self, obj):
        profile = getattr(obj.user, "investorprofile", None)
        if not profile or not profile.profile_picture:
            return None
        try:
            return profile.profile_picture.url
        except ValueError:
            return None


class OrgFieldWriteSerializer(serializers.Serializer):
    """P1.1: `SectionFieldView.put` used to accept `value=None` (-> IntegrityError
    500) and arbitrary `visibility` strings (-> a state no RLS policy
    recognizes, silently unenforceable)."""

    value = serializers.JSONField()
    visibility = serializers.ChoiceField(choices=Visibility.choices, required=False)


class OrgPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["name", "one_liner", "stage", "sector", "geo"]
        extra_kwargs = {f: {"required": False} for f in fields}


class OrgInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgInvite
        fields = [
            "id",
            "token",
            "role",
            "created_at",
            "revoked_at",
            "expires_at",
            "max_uses",
            "uses_count",
            "is_active",
        ]
        read_only_fields = [
            "id",
            "token",
            "created_at",
            "revoked_at",
            "expires_at",
            "max_uses",
            "uses_count",
            "is_active",
        ]
