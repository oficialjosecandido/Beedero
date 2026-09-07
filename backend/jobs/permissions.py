from rest_framework.permissions import BasePermission

from orgs.models import OrgMembership


class IsJobOrgOwnerOrAdmin(BasePermission):
    """Object-level check for a view whose object is a JobPost (not an org
    looked up by slug) — mirrors orgs.permissions.IsOrgOwnerOrAdmin's role
    check, applied to `obj.org` instead of `view.get_org()`."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        return OrgMembership.objects.filter(
            org=obj.org,
            user=request.user,
            role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
        ).exists()


def is_org_owner_or_admin(org, user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    return OrgMembership.objects.filter(
        org=org, user=user, role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
    ).exists()
