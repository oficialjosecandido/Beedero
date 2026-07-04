import uuid
from collections import defaultdict

from django.core.files.storage import default_storage
from rest_framework import serializers

from .constants import ACTIVITY_KINDS
from .models import (
    FundraiseRound,
    OrgField,
    OrgInvite,
    OrgMembership,
    OrgSection,
    RestrictedAccessLog,
    Visibility,
    VisibilityGrant,
)
from .visibility import VisibilityResolver


def _org_summary(org):
    return {
        "slug": org.slug,
        "name": org.name,
        "logo": org.logo.url if org.logo else None,
        "is_verified": org.is_verified,
        "is_fundraising": org.is_fundraising,
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
        return {
            "org": _org_summary(self.org),
            "sections": sections,
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
        if logs:
            RestrictedAccessLog.objects.bulk_create(logs)


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
            "use_of_funds",
            "stage",
            "is_open",
            "opened_at",
            "closed_at",
        ]
        read_only_fields = ["org", "is_open", "opened_at", "closed_at"]


class FeedPostSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[(k.value, k.label) for k in ACTIVITY_KINDS])
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(allow_blank=True, required=False, default="")
    occurred_at = serializers.DateTimeField()
    image = serializers.ImageField(required=False, allow_null=True)

    def create(self, org: "Organization"):
        section = OrgSection.objects.get(org=org, kind=self.validated_data["kind"])
        key = f"post_{uuid.uuid4().hex[:12]}"
        value = {
            "title": self.validated_data["title"],
            "body": self.validated_data.get("body", ""),
            "occurred_at": self.validated_data["occurred_at"].isoformat(),
        }
        image = self.validated_data.get("image")
        if image:
            path = default_storage.save(f"posts/{uuid.uuid4().hex}_{image.name}", image)
            value["image"] = default_storage.url(path)
        return OrgField.objects.create(section=section, key=key, value=value)


class OrgMembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = OrgMembership
        fields = ["id", "email", "role"]
        read_only_fields = ["id", "email"]


class OrgInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgInvite
        fields = ["id", "token", "role", "created_at", "revoked_at", "uses_count", "is_active"]
        read_only_fields = ["id", "token", "created_at", "revoked_at", "uses_count", "is_active"]
