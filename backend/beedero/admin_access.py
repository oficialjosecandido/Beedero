"""Allowlist gate for internal admin-only views (e.g. /admin/kpis/).

Layered on top of `staff_member_required` rather than replacing it: even if
another account gains `is_staff` by accident, it still won't see anything
gated by `kpi_admin_required` unless its email is also in the allowlist.
"""

from functools import wraps

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponseForbidden

# The founding admin: the account the Nexus is handed to before anyone else
# has it. Its own constant because KPI_ADMIN_EMAILS is a set — unordered, so
# "first" cannot be read off it — and because ensure_nexus_admins promotes
# this address by name.
FIRST_ADMIN_EMAIL = "josevcandido@gmail.com"

KPI_ADMIN_EMAILS = {FIRST_ADMIN_EMAIL, "pt.bidnow@gmail.com"}


def kpi_admin_required(view):
    @wraps(view)
    @staff_member_required
    def _wrapped(request, *args, **kwargs):
        if (request.user.email or "").lower() not in KPI_ADMIN_EMAILS:
            return HttpResponseForbidden("Not authorized.")
        return view(request, *args, **kwargs)

    return _wrapped
