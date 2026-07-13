from rest_framework.permissions import BasePermission

from orgs.models import OrgMembership


class IsCommentAuthorOrOrgOwner(BasePermission):
    """Mirrors orgs.permissions.IsOrgOwnerOrAdmin — object-level, checked via
    check_object_permissions() against a fetched Comment."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if obj.author_id == request.user.id:
            return True
        org_id = obj.activity.org_id
        if not org_id:
            return False
        return OrgMembership.objects.filter(
            org_id=org_id,
            user=request.user,
            role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
        ).exists()
