from django.contrib.auth import get_user_model
from rest_framework import serializers

from orgs.posting.imaging import PostImageValidationMixin

from .models import InvestorPost, InvestorProfile
from .visibility import ALL_LEVELS

User = get_user_model()
VISIBILITY_SECTIONS = {"bio", "country", "memberships", "posts", "attestations"}


class InvestorProfileSerializer(serializers.ModelSerializer):
    is_complete = serializers.BooleanField(read_only=True)
    has_public_handle = serializers.BooleanField(read_only=True)

    class Meta:
        model = InvestorProfile
        fields = [
            "is_verified",
            "verified_at",
            "full_name",
            "headline",
            "bio",
            "country",
            "profile_picture",
            "cover_image",
            "stage_focus",
            "sector_focus",
            "geo_focus",
            "check_min",
            "check_max",
            "handle",
            "visibility",
            "attestation_prefs",
            "is_complete",
            "has_public_handle",
        ]
        read_only_fields = ["is_verified", "verified_at", "handle"]

    def validate_full_name(self, value):
        if self.instance and self.instance.full_name and value != self.instance.full_name:
            raise serializers.ValidationError("Full name cannot be changed.")
        return value

    def validate_visibility(self, value):
        if not value:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Visibility must be an object.")
        for key, level in value.items():
            if key not in VISIBILITY_SECTIONS:
                raise serializers.ValidationError(f"Unknown visibility section: {key}")
            if level not in ALL_LEVELS:
                raise serializers.ValidationError(f"Invalid visibility level for {key}.")
        return value

    def validate_attestation_prefs(self, value):
        if not value:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Attestation preferences must be an object.")
        allowed = set(InvestorProfile.DEFAULT_ATTESTATION_PREFS.keys())
        for key in value:
            if key not in allowed:
                raise serializers.ValidationError(f"Unknown attestation preference: {key}")
        return value


class InvestorPostSerializer(PostImageValidationMixin, serializers.Serializer):
    """Validation only — persisted as an orgs.Activity via
    orgs.services.create_activity, not an InvestorPost (kept as a legacy,
    unread table; see orgs.models.Activity)."""

    kind = serializers.ChoiceField(choices=InvestorPost.Kind.choices)
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(allow_blank=True, required=False, default="")
    occurred_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("image") and attrs.get("kind") == InvestorPost.Kind.MILESTONE:
            raise serializers.ValidationError({"image": "Milestones cannot include photos."})
        ends_at = attrs.get("ends_at")
        if ends_at and attrs.get("kind") == InvestorPost.Kind.EVENT and ends_at <= attrs["occurred_at"]:
            raise serializers.ValidationError({"ends_at": "End time must be after the start time."})
        return attrs


class MeSerializer(serializers.ModelSerializer):
    investor_profile = InvestorProfileSerializer(source="investorprofile", read_only=True)
    memberships = serializers.SerializerMethodField()
    is_email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "is_email_verified", "investor_profile", "memberships"]

    def get_memberships(self, obj):
        return [{"org": m.org.slug, "role": m.role} for m in obj.orgmembership_set.select_related("org")]
