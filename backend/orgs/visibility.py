from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet
from django.utils.timezone import now

from .models import Activity, OrgField, OrgMembership, Organization, Visibility, VisibilityGrant

User = get_user_model()


def activity_visible_to(viewer: User | None, activity: Activity) -> bool:
    """App-layer mirror of the `activity_visibility` RLS policy (migration
    0014) — defense in depth, and lets views/tests reason about visibility
    without round-tripping through Postgres. No VisibilityGrant branch: a
    restricted Activity is members-only for now (see plan §0 — grants are
    never org-wide today)."""
    if activity.visibility == Visibility.PUBLIC or activity.org_id is None:
        return True
    if not viewer or not viewer.is_authenticated:
        return False
    return OrgMembership.objects.filter(org_id=activity.org_id, user=viewer).exists()


class VisibilityResolver:
    """Single source of truth. All profile access goes through here (§3.2)."""

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
            return qs  # members see everything (including private)
        allowed = Q(visibility=Visibility.PUBLIC)
        if self.viewer and self.viewer.is_authenticated:
            # restricted becomes visible via a direct grant to the field OR a grant
            # to the whole section (e.g. automatic grant to verified_investor when
            # opening a round, before any fields are filled in).
            restricted = Q(visibility=Visibility.RESTRICTED) & (
                Q(id__in=self._granted_field_ids()) | Q(section_id__in=self._granted_section_ids())
            )
            allowed |= restricted
        return qs.filter(allowed)  # 'private' never gets through for non-members

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
