"""Stripe webhook (doc §6) — wired up but at rest: no paid plan is for sale
yet, so nothing calls Stripe to generate these events in production.

Being at rest is exactly why the endpoint has to be strict. It is public
(`AllowAny`, no authentication class — Stripe cannot carry a Firebase token),
it is exempt from the RLS middleware, and it writes to the subscription state
machine that gates every paid entitlement. Unverified, it would let anyone who
knows the URL hand us `{"type": "customer.subscription.updated", "data":
{"object": {"id": "<any subscription>", "status": "active"}}}` and switch a
plan on.

So: the signature is verified against the raw body before the payload is
parsed, deliveries are deduplicated by event id, and only the three event
types this state machine understands are acted on. Without
STRIPE_WEBHOOK_SECRET set, verification fails closed and every delivery is
rejected.
"""

import json

from django.conf import settings
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProcessedWebhookEvent, Subscription
from .webhook_signature import SignatureError, verify_signature

# Everything else Stripe sends is acknowledged and dropped. An allowlist
# rather than a chain of `if`s so a newly enabled event type can't fall
# through into a handler that was written for a different shape of payload.
HANDLED_EVENT_TYPES = frozenset(
    {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }
)


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        # `request.body` before anything touches `request.data`: the signature
        # covers these exact bytes, and DRF's parsers consume the stream.
        payload = request.body

        try:
            verify_signature(
                payload,
                request.headers.get("Stripe-Signature", ""),
                settings.STRIPE_WEBHOOK_SECRET,
            )
        except SignatureError:
            # No detail in the response: the caller is either Stripe (which
            # does not read it) or someone probing, and "timestamp too old"
            # versus "signature mismatch" tells a prober which half to fix.
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event = json.loads(payload)
        except (ValueError, UnicodeDecodeError):
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(event, dict):
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)

        event_id = str(event.get("id") or "")
        event_type = str(event.get("type") or "")
        if not event_id:
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)

        if event_type not in HANDLED_EVENT_TYPES:
            # 2xx on purpose: a 4xx here would have Stripe retry an event we
            # will never act on, for days.
            return Response({"received": True, "handled": False}, status=status.HTTP_200_OK)

        with transaction.atomic():
            _row, created = ProcessedWebhookEvent.objects.get_or_create(
                event_id=event_id, defaults={"event_type": event_type}
            )
            if not created:
                return Response({"received": True, "duplicate": True}, status=status.HTTP_200_OK)
            # Inside the same transaction as the idempotency row, so a handler
            # that blows up doesn't leave the event marked as processed.
            self._apply(event_type, event.get("data", {}).get("object", {}))

        return Response({"received": True, "handled": True}, status=status.HTTP_200_OK)

    def _apply(self, event_type, obj):
        if not isinstance(obj, dict):
            return
        provider_ref = str(obj.get("id") or "")
        if not provider_ref:
            return

        if event_type == "customer.subscription.deleted":
            Subscription.objects.filter(provider_ref=provider_ref).update(
                status=Subscription.Status.CANCELED
            )
            return

        sub = Subscription.objects.filter(provider_ref=provider_ref).first()
        if sub is None:
            return
        # Only a status this model actually declares: Stripe has more of them
        # (`incomplete`, `trialing`, `unpaid`, ...) and writing one straight
        # through would put a value in the column that no entitlement check
        # knows how to read.
        new_status = obj.get("status")
        if new_status in Subscription.Status.values:
            sub.status = new_status
            sub.save(update_fields=["status"])
