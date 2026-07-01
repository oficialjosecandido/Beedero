from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import FUNDRAISE_KINDS, SectionKind
from .discovery import discover
from .models import (
    FundraiseRound,
    OrgField,
    OrgMembership,
    Organization,
    OrgSection,
    RestrictedAccessLog,
    VisibilityGrant,
)
from .permissions import IsOrgMember, IsOrgOwnerOrAdmin, IsVerifiedInvestor, OrgLookupMixin
from .public import public_profile
from .serializers import (
    FeedPostSerializer,
    FundraiseRoundSerializer,
    OrgProfileSerializer,
    VisibilityGrantSerializer,
)
from .visibility import VisibilityResolver


class PublicOrgProfileView(APIView):
    """§4: GET /api/public/orgs/<slug>/ — sem auth, só campos public."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        return Response(public_profile(slug))


class OrgListCreateView(APIView):
    """Não está na tabela §4, mas é indispensável: o founder precisa de criar
    a sua org antes de haver algo para visitar."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = OrgMembership.objects.filter(user=request.user).select_related("org")
        return Response(
            [{"slug": m.org.slug, "name": m.org.name, "role": m.role} for m in memberships]
        )

    def post(self, request):
        slug = request.data.get("slug")
        name = request.data.get("name")
        if not slug or not name:
            return Response({"detail": "slug e name são obrigatórios."}, status=400)
        if Organization.objects.filter(slug=slug).exists():
            return Response({"detail": "slug já em uso."}, status=400)
        org = Organization.objects.create(
            slug=slug,
            name=name,
            stage=request.data.get("stage", ""),
            sector=request.data.get("sector", ""),
            geo=request.data.get("geo", ""),
        )
        OrgMembership.objects.create(org=org, user=request.user, role=OrgMembership.Role.OWNER)
        return Response({"slug": org.slug, "name": org.name}, status=status.HTTP_201_CREATED)


class OrgProfileView(OrgLookupMixin, APIView):
    """§4: GET /api/orgs/<slug>/ — perfil completo filtrado pelo VisibilityResolver."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        org = self.get_org()
        resolver = VisibilityResolver(viewer=request.user, org=org)
        data = OrgProfileSerializer(org, resolver, request=request).data()
        return Response(data)


class SectionListView(OrgLookupMixin, APIView):
    """Não está na tabela §4, mas o dashboard precisa dos IDs de secção (não
    só o kind) para poder direcionar grants a uma secção concreta."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        sections = OrgSection.objects.filter(org=org, archived_at__isnull=True).order_by("position")
        return Response(
            [
                {
                    "id": s.id,
                    "kind": s.kind,
                    "visibility": s.visibility,
                    "fields": [
                        {"id": f.id, "key": f.key, "value": f.value, "visibility": f.visibility}
                        for f in s.fields.all()
                    ],
                }
                for s in sections
            ]
        )


class SectionFieldView(OrgLookupMixin, APIView):
    """Não está na tabela §4, mas o dashboard precisa disto para o founder
    conseguir preencher About/Team/Financials/Data Room. Visibilidade não
    passada explicitamente herda a da secção (mesma regra do OrgField.save())."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def put(self, request, slug, kind, key):
        org = self.get_org()
        section = get_object_or_404(OrgSection, org=org, kind=kind, archived_at__isnull=True)
        field, created = OrgField.objects.get_or_create(
            section=section, key=key, defaults={"value": request.data.get("value")}
        )
        if not created:
            field.value = request.data.get("value")
        visibility = request.data.get("visibility")
        if visibility:
            field.visibility = visibility
        field.save()
        return Response({"key": field.key, "value": field.value, "visibility": field.visibility})

    def delete(self, request, slug, kind, key):
        org = self.get_org()
        section = get_object_or_404(OrgSection, org=org, kind=kind)
        OrgField.objects.filter(section=section, key=key).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DataRoomView(OrgLookupMixin, APIView):
    """§4: GET /api/orgs/<slug>/dataroom/ — grava audit log por documento aberto."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember | IsVerifiedInvestor]

    def get(self, request, slug):
        org = self.get_org()
        resolver = VisibilityResolver(viewer=request.user, org=org)
        fields = list(
            resolver.visible_fields()
            .filter(section__kind=SectionKind.DATA_ROOM)
            .select_related("section")
        )
        if not resolver.is_member:
            RestrictedAccessLog.objects.bulk_create(
                [
                    RestrictedAccessLog(
                        viewer=request.user,
                        org=org,
                        field_key=f.key,
                        section_kind=f.section.kind,
                        ip=request.META.get("REMOTE_ADDR"),
                    )
                    for f in fields
                ]
            )
        return Response({"documents": {f.key: f.value for f in fields}})


class GrantListCreateView(OrgLookupMixin, APIView):
    """§4: POST /api/orgs/<slug>/grants/ — abrir/fechar acesso, só o owner."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        grants = VisibilityGrant.objects.filter(org=org)
        return Response(VisibilityGrantSerializer(grants, many=True).data)

    def post(self, request, slug):
        org = self.get_org()
        serializer = VisibilityGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(org=org, granted_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GrantDetailView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def delete(self, request, slug, grant_id):
        org = self.get_org()
        VisibilityGrant.objects.filter(org=org, id=grant_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoundOpenView(OrgLookupMixin, APIView):
    """§4: POST /api/orgs/<slug>/rounds/ — abre ronda, cria secções fundraise
    restricted e concede acesso automático ao role verified_investor."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        round_ = getattr(org, "fundraiseround", None)
        if round_ and round_.is_open:
            return Response({"detail": "Já existe uma ronda aberta."}, status=400)

        data = request.data
        if round_ is None:
            serializer = FundraiseRoundSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            round_ = serializer.save(org=org)
        else:
            for field in ("valuation", "ask_amount", "use_of_funds", "stage"):
                if field in data:
                    setattr(round_, field, data[field])
            round_.is_open = True
            round_.closed_at = None
            round_.save()

        org.is_fundraising = True
        org.save(update_fields=["is_fundraising"])

        for kind in FUNDRAISE_KINDS:
            section, _ = OrgSection.objects.get_or_create(org=org, kind=kind)
            if section.archived_at is not None:
                section.archived_at = None
                section.save(update_fields=["archived_at"])
            VisibilityGrant.objects.get_or_create(
                org=org,
                section=section,
                principal_type=VisibilityGrant.Principal.ROLE,
                principal_id="verified_investor",
            )

        return Response(FundraiseRoundSerializer(round_).data, status=status.HTTP_201_CREATED)


class RoundCloseView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        round_ = get_object_or_404(FundraiseRound, org=org, is_open=True)
        round_.is_open = False
        round_.closed_at = timezone.now()
        round_.save()

        org.is_fundraising = False
        org.save(update_fields=["is_fundraising"])

        # Arquivadas, não apagadas (§1): saem do resolver mas o histórico fica.
        OrgSection.objects.filter(org=org, kind__in=FUNDRAISE_KINDS).update(
            archived_at=timezone.now()
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedPostView(OrgLookupMixin, APIView):
    """§4: POST /api/orgs/<slug>/feed/ — publicar novidade/milestone/evento/award."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def post(self, request, slug):
        org = self.get_org()
        serializer = FeedPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        field = serializer.create(org)
        return Response({"key": field.key, "value": field.value}, status=status.HTTP_201_CREATED)


class DiscoveryView(APIView):
    """§4: GET /api/discovery/?stage=&sector=&geo=&check="""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = discover(request.user, request.query_params)
        return Response(
            [
                {
                    "slug": o.slug,
                    "name": o.name,
                    "stage": o.stage,
                    "sector": o.sector,
                    "geo": o.geo,
                    "is_verified": o.is_verified,
                    "is_fundraising": o.is_fundraising,
                }
                for o in qs
            ]
        )
