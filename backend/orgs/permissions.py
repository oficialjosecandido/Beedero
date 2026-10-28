from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import OrgMembership


class OrgLookupMixin:
    """Views that operate on an Organization identified by <slug> in the URL.

    Mutating methods need an active plan (billing/access.py). Reads stay open
    for whoever already has permission. Billing checkout/redeem/portal set
    `requires_org_plan = False` so an unpaid organisation can still pay.
    """

    requires_org_plan = True

    def get_org(self):
        from django.shortcuts import get_object_or_404

        from .models import Organization

        return get_object_or_404(Organization, slug=self.kwargs["slug"])

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not self.requires_org_plan or request.method in SAFE_METHODS:
            return
        from billing.access import require_access

        require_access(self.get_org())


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


class IsOrgOwner(BasePermission):
    """Owners only. Admins run the organisation day to day; ending it is not
    part of that — deleting it takes the whole team's work with it."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return OrgMembership.objects.filter(
            org=view.get_org(), user=request.user, role=OrgMembership.Role.OWNER
        ).exists()


class IsVerifiedInvestor(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "investorprofile", None)
        return bool(profile and profile.is_verified)
