"""Who may open the Nexus, and what each role may do.

  admin — staff (`is_staff`) whose email is in the same allowlist as the KPI
          panel (beedero/admin_access.py). Everything.
  staff — any other `is_staff` account. The queues: people, organisations,
          posts and reports, removing posts and resolving reports. No KPIs,
          revenue, newsletter, suspensions or plan changes.

Everyone else gets a 404 for every Nexus URL — not a 403 — so it tells
them nothing about what is there.
"""

from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import BasePermission

from beedero.admin_access import KPI_ADMIN_EMAILS

ADMIN = "admin"
STAFF = "staff"

CAPABILITIES = {
    STAFF: {"home", "users", "orgs", "posts", "reports"},
    ADMIN: {
        "home",
        "overview",
        "users",
        "users.manage",
        "orgs",
        "orgs.manage",
        "posts",
        "posts.restore",
        "reports",
        "reports.suspend",
        "newsletter",
        "billing",
        "audit",
    },
}


def nexus_role(user) -> str | None:
    if user is None or not user.is_authenticated or not user.is_active or not user.is_staff:
        return None
    if (user.email or "").strip().lower() in KPI_ADMIN_EMAILS:
        return ADMIN
    return STAFF


def can(user, capability: str) -> bool:
    role = nexus_role(user)
    return role is not None and capability in CAPABILITIES[role]


class IsNexusStaff(BasePermission):
    def has_permission(self, request, view):
        if nexus_role(request.user) is None:
            raise NotFound()
        return True


class IsNexusAdmin(BasePermission):
    def has_permission(self, request, view):
        role = nexus_role(request.user)
        if role is None:
            raise NotFound()
        if role != ADMIN:
            raise PermissionDenied("Only Nexus admins can do this.")
        return True


def require(user, capability: str) -> None:
    """For actions inside a staff view that only admins may take."""
    if not can(user, capability):
        raise PermissionDenied("Only Nexus admins can do this.")
