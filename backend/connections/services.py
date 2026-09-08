"""No open messaging between strangers, no exceptions (doc: "sem exceções —
nem investidores verificados"). First contact is always a connection
request with an optional note; accepting one both creates the Connection
and opens the conversation with the note as the first message. Mirrors
messaging/services.py's plain-function, @transaction.atomic-on-writes
convention."""

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from beedero.ratelimit import enforce_rate_limit
from messaging.services import get_or_create_conversation, is_blocked, send_message
from notifications.models import Notification
from notifications.services import notify

from .models import Connection, ConnectionRequest

logger = logging.getLogger(__name__)

# The spec's 4-tier reputation system, mapped onto real signals: there is no
# identity-verification flag distinct from investor verification today, so
# email verification stands in for "verified_identity".
REQUEST_LIMITS = {
    "verified_investor": 50,
    "verified_identity": 20,
    "unverified": 8,
    "unverified_new": 3,
}

NEW_ACCOUNT_WINDOW = timedelta(days=7)


def reputation_tier(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.is_verified:
        return "verified_investor"
    if user.is_email_verified:
        return "verified_identity"
    if timezone.now() - user.date_joined < NEW_ACCOUNT_WINDOW:
        return "unverified_new"
    return "unverified"


def daily_request_limit(user) -> int:
    return REQUEST_LIMITS[reputation_tier(user)]


# Numeric form of reputation_tier() — lower is more credible. Shared so
# every place that needs to rank/sort people by reputation (pending
# request sorting, the connections list) uses the same ranking.
_TIER_RANK = {"verified_investor": 0, "verified_identity": 1, "unverified": 2, "unverified_new": 3}


def credibility_weight(user) -> int:
    return _TIER_RANK[reputation_tier(user)]


def are_connected(user_a, user_b) -> bool:
    if user_a.id == user_b.id:
        return False
    first, second = sorted([user_a, user_b], key=lambda u: u.id)
    return Connection.objects.filter(user_one=first, user_two=second).exists()


def connected_user_ids(user):
    """The other party's id for every one of `user`'s connections. Used
    wherever a "people I follow" signal used to live (feed inclusion,
    recommendation exclusion) — people are connected with, not followed."""
    connections = Connection.objects.filter(Q(user_one=user) | Q(user_two=user))
    return [c.user_two_id if c.user_one_id == user.id else c.user_one_id for c in connections]


def remove_connection(user, connection_id) -> None:
    connection = Connection.objects.filter(pk=connection_id).first()
    if connection is None or user.id not in (connection.user_one_id, connection.user_two_id):
        raise Http404
    connection.delete()


def can_message_directly(sender, recipient) -> bool:
    if sender is None or recipient is None or sender.id == recipient.id:
        return False
    if is_blocked(sender, recipient):
        return False
    return are_connected(sender, recipient)


def connection_status(viewer, other) -> str:
    if viewer is None or other is None or viewer.id == other.id:
        return "none"
    if are_connected(viewer, other):
        return "connected"
    pending = ConnectionRequest.objects.filter(
        Q(requester=viewer, recipient=other) | Q(requester=other, recipient=viewer),
        status=ConnectionRequest.Status.PENDING,
    ).first()
    if pending is None:
        return "none"
    return "pending_sent" if pending.requester_id == viewer.id else "pending_received"


@transaction.atomic
def send_request(requester, recipient, note="") -> ConnectionRequest:
    if requester.id == recipient.id:
        raise ValidationError({"recipient_id": "You can't send a connection request to yourself."})
    if is_blocked(requester, recipient):
        raise PermissionDenied("You can't contact this user.")
    if are_connected(requester, recipient):
        raise ValidationError({"recipient_id": "You're already connected."})
    existing = ConnectionRequest.objects.filter(
        Q(requester=requester, recipient=recipient) | Q(requester=recipient, recipient=requester),
        status=ConnectionRequest.Status.PENDING,
    ).first()
    if existing is not None:
        raise ValidationError({"recipient_id": "There's already a pending request between you."})

    enforce_rate_limit(
        f"connection-request:{requester.id}", limit=daily_request_limit(requester), window_seconds=86400
    )

    # The existence check above is check-then-create, so two concurrent
    # requests between the same pair can both pass it before either commits.
    # The nested atomic() gives the INSERT its own savepoint (mirrors
    # orgs/views.py::OrgListCreateView.post) so a uniq_pending_connection_request
    # collision only unwinds this insert instead of poisoning the request's
    # outer transaction.
    try:
        with transaction.atomic():
            request = ConnectionRequest.objects.create(requester=requester, recipient=recipient, note=note)
    except IntegrityError:
        logger.warning(
            "Duplicate connection request race: requester=%s recipient=%s", requester.id, recipient.id
        )
        raise ValidationError({"recipient_id": "There's already a pending request between you."}) from None
    notify(
        recipient,
        kind=Notification.Kind.CONNECTION_REQUEST,
        aggregate_key=f"connection_request:{request.id}",
        title="New connection request",
        body=f"{_display_name(requester)} wants to connect with you.",
        link="/connections",
    )
    return request


@transaction.atomic
def accept_request(req: ConnectionRequest, by):
    """Returns (connection, conversation). A direct-message thread is always
    opened on accept; if the request carried a note, it becomes the first
    message."""
    if req.status != ConnectionRequest.Status.PENDING:
        raise ValidationError("This request is no longer pending.")
    if by.id != req.recipient_id:
        raise PermissionDenied("Only the recipient can accept this request.")

    req.status = ConnectionRequest.Status.ACCEPTED
    req.responded_at = timezone.now()
    req.save(update_fields=["status", "responded_at"])

    first, second = sorted([req.requester, req.recipient], key=lambda u: u.id)
    connection, _ = Connection.objects.get_or_create(user_one=first, user_two=second)

    conversation = get_or_create_conversation(req.requester, req.recipient)
    if req.note:
        # notify_recipient=False: `by` (the recipient) already read this note
        # as part of the pending request they're accepting right now — the
        # CONNECTION_ACCEPTED notification below is the only one req.requester
        # needs, and a "new message" notification to `by` would be redundant.
        send_message(conversation, req.requester, req.note, notify_recipient=False)

    notify(
        req.requester,
        kind=Notification.Kind.CONNECTION_ACCEPTED,
        aggregate_key=f"connection_accepted:{req.id}",
        title="Connection accepted",
        body=f"{_display_name(req.recipient)} accepted your connection request.",
        link="/feed",
    )
    return connection, conversation


def decline_request(req: ConnectionRequest, by) -> None:
    if req.status != ConnectionRequest.Status.PENDING:
        raise ValidationError("This request is no longer pending.")
    if by.id != req.recipient_id:
        raise PermissionDenied("Only the recipient can decline this request.")
    req.status = ConnectionRequest.Status.DECLINED
    req.responded_at = timezone.now()
    req.save(update_fields=["status", "responded_at"])


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]
