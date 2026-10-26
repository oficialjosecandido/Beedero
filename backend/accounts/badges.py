"""One endpoint for every counter in the app chrome.

The header and sidebar badges used to be fed by three independent client
timers — /api/notifications/unread-count/, /api/messaging/unread-count/ and
/api/network/counts/ — so a signed-in tab sitting idle made three requests,
three token verifications and three connection checkouts a minute to collect
five integers. This serves all of them in one round trip.

The dedicated endpoints stay: they are what a mutation refreshes when only
its own counter can have changed (sending a message, accepting a request).
Both read the same helpers, so the two paths cannot drift apart.
"""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from messaging.services import total_unread_count
from network.services import network_counts
from notifications.services import unread_count


class BadgeCountsView(APIView):
    """GET /api/me/badges/ — every chrome counter for the signed-in user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                # Each key mirrors the payload of the endpoint it replaces, so
                # the client can hand the slice straight to the same reducer.
                "notifications": {"unread_count": unread_count(user)},
                "messages": {"unread_count": total_unread_count(user)},
                "network": network_counts(user),
            }
        )
