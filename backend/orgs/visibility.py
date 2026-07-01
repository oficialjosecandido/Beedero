from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet
from django.utils.timezone import now

from .models import OrgField, OrgMembership, Organization, Visibility, VisibilityGrant

User = get_user_model()


class VisibilityResolver:
    """Ponto único de verdade. Todo o acesso a perfis passa por aqui (§3.2)."""

    def __init__(self, viewer: User | None, org: Organization):
        self.viewer = viewer
        self.org = org
        self._member = self._is_member()

    def _is_member(self) -> bool:
        if not self.viewer or not self.viewer.is_authenticated:
            return False
        return OrgMembership.objects.filter(org=self.org, user=self.viewer).exists()

    @property
    def is_member(self) -> bool:
        return self._member

    def visible_fields(self) -> "QuerySet[OrgField]":
        qs = OrgField.objects.filter(section__org=self.org, section__archived_at__isnull=True)
        if self._member:
            return qs  # membros veem tudo (inclui private)
        allowed = Q(visibility=Visibility.PUBLIC)
        if self.viewer and self.viewer.is_authenticated:
            # restricted fica visível por grant direto ao campo OU por grant à
            # secção inteira (ex: grant automático a verified_investor ao
            # abrir ronda, antes de existirem campos preenchidos).
            restricted = Q(visibility=Visibility.RESTRICTED) & (
                Q(id__in=self._granted_field_ids()) | Q(section_id__in=self._granted_section_ids())
            )
            allowed |= restricted
        return qs.filter(allowed)  # 'private' nunca entra para não-membros

    def _granted_field_ids(self) -> set[int]:
        principals = self._viewer_principals()
        grants = VisibilityGrant.objects.filter(
            org=self.org,
            field__isnull=False,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now()))
        return {g.field_id for g in grants if g.matches(principals)}

    def _granted_section_ids(self) -> set[int]:
        principals = self._viewer_principals()
        grants = VisibilityGrant.objects.filter(
            org=self.org,
            section__isnull=False,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now()))
        return {g.section_id for g in grants if g.matches(principals)}

    def _viewer_principals(self) -> set[tuple[str, str]]:
        p = set()
        if not self.viewer or not self.viewer.is_authenticated:
            return p
        p.add(("user", str(self.viewer.id)))
        for m in OrgMembership.objects.filter(user=self.viewer):
            p.add(("org", str(m.org_id)))
        inv = getattr(self.viewer, "investorprofile", None)
        if inv and inv.is_verified:
            p.add(("role", "verified_investor"))
        return p
