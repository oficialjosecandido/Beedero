from collections import defaultdict

from rest_framework import serializers

from .constants import ACTIVITY_KINDS
from .models import FundraiseRound, OrgField, OrgSection, RestrictedAccessLog, Visibility, VisibilityGrant
from .visibility import VisibilityResolver


class OrgProfileSerializer:
    """Camada 3 (§3.3): o schema de saída é construído a partir do que o
    resolver autorizou — nunca por corte de um objeto completo."""

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
            "org": {
                "slug": self.org.slug,
                "name": self.org.name,
                "is_verified": self.org.is_verified,
                "is_fundraising": self.org.is_fundraising,
            },
            "sections": sections,
        }

    def _log_restricted(self, fields):
        # §2.5: regista quem abriu que campo restrito, quando. Não regista
        # membros a verem os campos da própria org — não é acesso de terceiro.
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
            raise serializers.ValidationError("O grant precisa de section ou field.")
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

    def create(self, org: "Organization"):
        import uuid

        section = OrgSection.objects.get(org=org, kind=self.validated_data["kind"])
        key = f"post_{uuid.uuid4().hex[:12]}"
        return OrgField.objects.create(
            section=section,
            key=key,
            value={
                "title": self.validated_data["title"],
                "body": self.validated_data.get("body", ""),
                "occurred_at": self.validated_data["occurred_at"].isoformat(),
            },
        )
