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


def viewer_principals(viewer: User | None) -> set[tuple[str, str]]:
    """Who the viewer counts as, for grant matching.

    Viewer-scoped, not org-scoped — the same answer for every org in a
    request, which is why it is a free function the bulk path can call once
    instead of a method each resolver repeats.
    """
    principals: set[tuple[str, str]] = set()
    if not viewer or not viewer.is_authenticated:
        return principals
    principals.add(("user", str(viewer.id)))
    for m in OrgMembership.objects.filter(user=viewer):
        principals.add(("org", str(m.org_id)))
    inv = getattr(viewer, "investorprofile", None)
    if inv and inv.is_verified:
        principals.add(("role", "verified_investor"))
    return principals


def member_org_ids(viewer: User | None, org_ids) -> set[int]:
    """Of `org_ids`, the ones the viewer is a member of — one query."""
    if not viewer or not viewer.is_authenticated:
        return set()
    ids = list(dict.fromkeys(org_ids))
    if not ids:
        return set()
    return set(
        OrgMembership.objects.filter(user=viewer, org_id__in=ids).values_list("org_id", flat=True)
    )


def _granted_ids(viewer: User | None, org_ids, principals=None) -> tuple[set[int], set[int]]:
    """(granted field ids, granted section ids) across `org_ids` — one query.

    A restricted field becomes visible via a direct grant to the field OR a
    grant to the whole section (e.g. the automatic grant to verified_investor
    when a round opens, before any field is filled in).
    """
    ids = list(dict.fromkeys(org_ids))
    if not ids or not viewer or not viewer.is_authenticated:
        return set(), set()
    if principals is None:
        principals = viewer_principals(viewer)
    grants = (
        VisibilityGrant.objects.filter(org_id__in=ids)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now()))
        .filter(Q(field__isnull=False) | Q(section__isnull=False))
    )
    field_ids = set()
    section_ids = set()
    for grant in grants:
        if not grant.matches(principals):
            continue
        # Not elif: a grant naming both targets counts as both, which is what
        # the two separate queries this replaced did.
        if grant.field_id is not None:
            field_ids.add(grant.field_id)
        if grant.section_id is not None:
            section_ids.add(grant.section_id)
    return field_ids, section_ids


def visible_fields_for_orgs(viewer: User | None, org_ids) -> "QuerySet[OrgField]":
    """Every field across `org_ids` this viewer is entitled to see.

    The same rule as `VisibilityResolver.visible_fields`, resolved for many
    orgs at once: a resolver per org costs five or six queries (membership,
    two grant lookups, principals twice over), which discovery was paying up
    to 500 times in one request. This is four, whatever the candidate count.

    `private` still never gets through for a non-member, and a member still
    sees everything — per org, not globally: being a member of one candidate
    does not open the others.
    """
    ids = list(dict.fromkeys(org_ids))
    if not ids:
        return OrgField.objects.none()

    qs = OrgField.objects.filter(section__org_id__in=ids, section__archived_at__isnull=True)

    members = member_org_ids(viewer, ids)
    allowed = Q(visibility=Visibility.PUBLIC)
    if members:
        allowed |= Q(section__org_id__in=members)
    if viewer and viewer.is_authenticated:
        field_ids, section_ids = _granted_ids(viewer, ids)
        if field_ids or section_ids:
            allowed |= Q(visibility=Visibility.RESTRICTED) & (
                Q(id__in=field_ids) | Q(section_id__in=section_ids)
            )
    return qs.filter(allowed)


class VisibilityResolver:
    """Single source of truth. All profile access goes through here (§3.2).

    One org at a time. For a list of orgs use `visible_fields_for_orgs`,
    which applies the identical rule in a fixed number of queries — both are
    built from the same helpers above so the two cannot drift apart.
    """

    def __init__(self, viewer: User | None, org: Organization):
        self.viewer = viewer
        self.org = org
        self._member = self._is_member()
        self._principals = None

    def _is_member(self) -> bool:
        return self.org.id in member_org_ids(self.viewer, [self.org.id])

    @property
    def is_member(self) -> bool:
        return self._member

    def visible_fields(self) -> "QuerySet[OrgField]":
        qs = OrgField.objects.filter(section__org=self.org, section__archived_at__isnull=True)
        if self._member:
            return qs  # members see everything (including private)
        allowed = Q(visibility=Visibility.PUBLIC)
        if self.viewer and self.viewer.is_authenticated:
            field_ids, section_ids = _granted_ids(
                self.viewer, [self.org.id], self._viewer_principals()
            )
            allowed |= Q(visibility=Visibility.RESTRICTED) & (
                Q(id__in=field_ids) | Q(section_id__in=section_ids)
            )
        return qs.filter(allowed)  # 'private' never gets through for non-members

    def _viewer_principals(self) -> set[tuple[str, str]]:
        # Memoized: visible_fields() used to resolve the same viewer-scoped
        # set twice, once per grant lookup.
        if self._principals is None:
            self._principals = viewer_principals(self.viewer)
        return self._principals
