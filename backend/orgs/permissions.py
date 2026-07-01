from rest_framework.permissions import BasePermission

from .models import OrgMembership


class OrgLookupMixin:
    """Views que operam sobre uma Organization identificada por <slug> no URL."""

    def get_org(self):
        from django.shortcuts import get_object_or_404

        from .models import Organization

        return get_object_or_404(Organization, slug=self.kwargs["slug"])


class IsOrgMember(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return OrgMembership.objects.filter(org=view.get_org(), user=request.user).exists()


class IsOrgOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return OrgMembership.objects.filter(
            org=view.get_org(),
            user=request.user,
            role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
        ).exists()


class IsVerifiedInvestor(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "investorprofile", None)
        return bool(profile and profile.is_verified)
