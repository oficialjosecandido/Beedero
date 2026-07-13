from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers

from .models import InvestorPost, InvestorProfile

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "password", "confirm_password"]

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
        )


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


class MeSerializer(serializers.ModelSerializer):
    investor_profile = InvestorProfileSerializer(source="investorprofile", read_only=True)
    memberships = serializers.SerializerMethodField()
    is_email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "is_email_verified", "investor_profile", "memberships"]

    def get_memberships(self, obj):
        return [{"org": m.org.slug, "role": m.role} for m in obj.orgmembership_set.select_related("org")]


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop("username", None)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        attrs.pop("email", None)
        if not user:
            # No account matches this email — reject here rather than falling
            # through to simplejwt's validate(), which does attrs[username_field]
            # unconditionally and would raise an unhandled KeyError.
            raise AuthenticationFailed(
                self.error_messages["no_active_account"], "no_active_account"
            )
        attrs["username"] = user.get_username()
        return super().validate(attrs)
