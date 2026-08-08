from rest_framework import serializers

from .models import AdvisorProfile


class AdvisorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdvisorProfile
        fields = [
            "is_available",
            "expertise",
            "stages",
            "sectors",
            "engagement_types",
        ]
