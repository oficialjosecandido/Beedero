from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import InvestorPost, InvestorProfile

User = get_user_model()


class InvestorProfileSerializer(serializers.ModelSerializer):
    is_complete = serializers.BooleanField(read_only=True)

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
            "stage_focus",
            "sector_focus",
            "geo_focus",
            "check_min",
            "check_max",
            "is_complete",
        ]
        read_only_fields = ["is_verified", "verified_at"]


class InvestorPostSerializer(serializers.Serializer):
    """Validation only — persisted as an orgs.Activity via
    orgs.services.create_activity, not an InvestorPost (kept as a legacy,
    unread table; see orgs.models.Activity)."""

    kind = serializers.ChoiceField(choices=InvestorPost.Kind.choices)
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(allow_blank=True, required=False, default="")
    occurred_at = serializers.DateTimeField()
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("image") and attrs.get("kind") == InvestorPost.Kind.MILESTONE:
            raise serializers.ValidationError({"image": "Milestones cannot include photos."})
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
