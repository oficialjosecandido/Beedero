import csv
import io

from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.ratelimit import enforce_rate_limit
from orgs.models import Organization
from orgs.serializers import _org_summary

from .models import PipelineEntry
from .site_traffic import _client_ip, record_site_pageview


class PipelineEntrySerializer(serializers.ModelSerializer):
    org = serializers.SerializerMethodField()

    class Meta:
        model = PipelineEntry
        fields = [
            "id",
            "org",
            "stage",
            "note",
            "pass_reason",
            "next_action_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_org(self, obj):
        return _org_summary(obj.org)


class PipelineEntryWriteSerializer(serializers.ModelSerializer):
    org_slug = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = PipelineEntry
        fields = ["org_slug", "stage", "note", "pass_reason", "next_action_at"]

    def validate_stage(self, value):
        if value not in PipelineEntry.Stage.values:
            raise serializers.ValidationError("Invalid stage.")
        return value


class PipelineListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        entries = (
            PipelineEntry.objects.filter(investor=request.user)
            .select_related("org")
            .order_by("-updated_at", "-id")
        )
        return Response({"items": PipelineEntrySerializer(entries, many=True).data})

    def post(self, request):
        serializer = PipelineEntryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org_slug = serializer.validated_data.pop("org_slug")
        org = get_object_or_404(Organization, slug=org_slug, status=Organization.Status.LIVE)
        entry, created = PipelineEntry.objects.get_or_create(
            investor=request.user,
            org=org,
            defaults=serializer.validated_data,
        )
        if not created:
            for field, value in serializer.validated_data.items():
                setattr(entry, field, value)
            entry.save()
        return Response(PipelineEntrySerializer(entry).data, status=201 if created else 200)


class PipelineDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, entry_id):
        entry = get_object_or_404(PipelineEntry, pk=entry_id, investor=request.user)
        serializer = PipelineEntryWriteSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            if field != "org_slug":
                setattr(entry, field, value)
        entry.save()
        return Response(PipelineEntrySerializer(entry).data)

    def delete(self, request, entry_id):
        entry = get_object_or_404(PipelineEntry, pk=entry_id, investor=request.user)
        entry.delete()
        return Response(status=204)


class PipelineExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        entries = (
            PipelineEntry.objects.filter(investor=request.user)
            .select_related("org")
            .order_by("stage", "org__name")
        )
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["organization", "slug", "stage", "note", "pass_reason", "next_action_at", "updated_at"]
        )
        for entry in entries:
            writer.writerow(
                [
                    entry.org.name,
                    entry.org.slug,
                    entry.stage,
                    entry.note,
                    entry.pass_reason,
                    entry.next_action_at.isoformat() if entry.next_action_at else "",
                    entry.updated_at.isoformat(),
                ]
            )
        return Response(
            buffer.getvalue(),
            content_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="beedero-pipeline.csv"'},
        )


class SitePageViewSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=300)


class SitePageViewCreateView(APIView):
    """POST /api/analytics/pageview/ — first-party pageview beacon."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        enforce_rate_limit(f"site-pv:{_client_ip(request)}", limit=180, window_seconds=3600)
        serializer = SitePageViewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_site_pageview(request, serializer.validated_data["path"])
        return Response(status=status.HTTP_204_NO_CONTENT)
