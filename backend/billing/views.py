"""Stripe webhook scaffolding (doc §6) — wired up but at rest: no paid plan
is for sale yet, so nothing calls Stripe to generate these events in
production. Once STRIPE_WEBHOOK_SECRET is set, add signature verification
(`stripe.Webhook.construct_event`) before trusting the payload; until then
this only matters for local testing of the Subscription state machine.
"""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Subscription


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        event_type = request.data.get("type")
        data = request.data.get("data", {}).get("object", {})
        provider_ref = data.get("id", "")

        if event_type in ("customer.subscription.updated", "customer.subscription.created"):
            sub = Subscription.objects.filter(provider_ref=provider_ref).first()
            if sub:
                sub.status = data.get("status", sub.status)
                sub.save(update_fields=["status"])
        elif event_type == "customer.subscription.deleted":
            Subscription.objects.filter(provider_ref=provider_ref).update(
                status=Subscription.Status.CANCELED
            )

        return Response({"received": True}, status=status.HTTP_200_OK)
