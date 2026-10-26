from django.db.models import Q

from connections.models import Connection, ConnectionRequest
from orgs.models import OrgFollow


def network_counts(viewer) -> dict[str, int]:
    """The sidebar's network counters. Shared by /api/network/counts/ and the
    combined badge endpoint in accounts/badges.py."""
    return {
        "connections": Connection.objects.filter(
            Q(user_one=viewer) | Q(user_two=viewer)
        ).count(),
        "pending": ConnectionRequest.objects.filter(
            recipient=viewer, status=ConnectionRequest.Status.PENDING
        ).count(),
        "following": OrgFollow.objects.filter(user=viewer).count(),
    }
