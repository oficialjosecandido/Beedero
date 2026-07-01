from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import InvestorProfile

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class InvestorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestorProfile
        fields = [
            "is_verified",
            "verified_at",
            "stage_focus",
            "sector_focus",
            "geo_focus",
            "check_min",
            "check_max",
        ]
        read_only_fields = ["is_verified", "verified_at"]


class MeSerializer(serializers.ModelSerializer):
    investor_profile = InvestorProfileSerializer(source="investorprofile", read_only=True)
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "investor_profile", "memberships"]

    def get_memberships(self, obj):
        return [{"org": m.org.slug, "role": m.role} for m in obj.orgmembership_set.select_related("org")]
