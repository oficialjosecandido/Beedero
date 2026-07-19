"""Validated payloads per post kind — no loose JSON on write."""

from django.utils import timezone
from rest_framework import serializers

from .constants import PostKind


class UpdatePayloadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    body = serializers.CharField(max_length=2000)
    image = serializers.ImageField(required=False, allow_null=True)


class EventPayloadSerializer(serializers.Serializer):
    FORMAT_CHOICES = ("in_person", "online", "hybrid")

    title = serializers.CharField(max_length=120)
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    format = serializers.ChoiceField(choices=FORMAT_CHOICES)
    location = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    registration_url = serializers.URLField(required=False, allow_blank=True, default="")
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, data):
        if data["ends_at"] <= data["starts_at"]:
            raise serializers.ValidationError({"ends_at": "End time must be after the start time."})
        if data["starts_at"] < timezone.now():
            raise serializers.ValidationError(
                {"starts_at": "Past events should be published as an update or milestone."}
            )
        return data


class MilestonePayloadSerializer(serializers.Serializer):
    CATEGORY_CHOICES = ("traction", "product", "team", "funding", "award", "other")

    title = serializers.CharField(max_length=120)
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    category = serializers.ChoiceField(choices=CATEGORY_CHOICES)
    occurred_at = serializers.DateField(required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("image"):
            raise serializers.ValidationError({"image": "Milestones cannot include photos."})
        return attrs


PAYLOAD_SERIALIZERS = {
    PostKind.UPDATE: UpdatePayloadSerializer,
    PostKind.MILESTONE: MilestonePayloadSerializer,
    PostKind.EVENT: EventPayloadSerializer,
}


def validate_payload(kind: str, data) -> dict:
    serializer_class = PAYLOAD_SERIALIZERS.get(kind)
    if serializer_class is None:
        raise serializers.ValidationError({"kind": "Unsupported post kind."})
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data
