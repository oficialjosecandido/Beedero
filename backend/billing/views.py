"""Billing endpoints for organisations, and the Stripe webhook.

  GET  /api/billing/codes/<code>/              is this code usable?
  GET  /api/orgs/<slug>/billing/               the plan, for any member
  POST /api/orgs/<slug>/billing/checkout/      owners/admins → Stripe Checkout URL
  POST /api/orgs/<slug>/billing/redeem/        owners/admins → free year with a code
  POST /api/orgs/<slug>/billing/sync/          back from checkout → sync now
  POST /api/orgs/<slug>/billing/portal/        owners/admins → Stripe customer portal
  POST /api/billing/stripe/webhook/            Stripe, signature verified
"""

import logging

from django.core.exceptions import ImproperlyConfigured
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.ratelimit import enforce_rate_limit
from orgs.permissions import IsOrgMember, IsOrgOwnerOrAdmin, OrgLookupMixin

from . import subscriptions
from .access import org_billing_state
from .gateway import BillingUnavailable, get_gateway
from .plans import PLANS, TERMS_VERSION, public_prices

logger = logging.getLogger(__name__)

UNAVAILABLE = {"detail": "Payments are not available right now. Please try again later.", "code": "billing_unavailable"}


def _choice(request) -> str:
    choice = request.data.get("plan", "yearly")
    return choice if choice in PLANS else "yearly"


def billing_payload(org) -> dict:
    return {**org_billing_state(org), "prices": public_prices(), "terms_version": TERMS_VERSION}


class PromoCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        enforce_rate_limit(f"promo-check:{request.user.id}", limit=30, window_seconds=3600)
        found, problem = subscriptions.find_code(code)
        if problem:
            return Response({"valid": False, "detail": problem})
        return Response({"valid": True, "code": found.code, "free_days": found.free_days})


class OrgBillingView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]
    requires_org_plan = False

    def get(self, request, slug):
        return Response(billing_payload(self.get_org()))


class OrgCheckoutView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]
    requires_org_plan = False

    def post(self, request, slug):
        org = self.get_org()
        enforce_rate_limit(f"checkout:{org.id}", limit=20, window_seconds=3600)
        try:
            url = subscriptions.start_checkout(org, request.user, _choice(request))
        except (BillingUnavailable, ImproperlyConfigured):
            logger.exception("Checkout unavailable")
            return Response(UNAVAILABLE, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"url": url})


class OrgRedeemView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]
    requires_org_plan = False

    def post(self, request, slug):
        org = self.get_org()
        enforce_rate_limit(f"redeem:{org.id}", limit=10, window_seconds=3600)
        subscriptions.redeem_free_period(org, _choice(request), request.data.get("code", ""))
        return Response(billing_payload(org))


class OrgCheckoutSyncView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]
    requires_org_plan = False

    def post(self, request, slug):
        org = self.get_org()
        session_id = request.data.get("session_id", "")
        if session_id:
            try:
                subscriptions.sync_after_return(org, session_id)
            except (BillingUnavailable, ImproperlyConfigured):
                logger.exception("Checkout sync unavailable")
        return Response(billing_payload(org))


class OrgPortalView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]
    requires_org_plan = False

    def post(self, request, slug):
        org = self.get_org()
        try:
            return Response({"url": subscriptions.portal_url(org)})
        except (BillingUnavailable, ImproperlyConfigured):
            logger.exception("Portal unavailable")
            return Response(UNAVAILABLE, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class StripeWebhookView(APIView):
    """Stripe calls this; nothing in the payload is trusted until the
    Stripe-Signature header checks out against STRIPE_WEBHOOK_SECRET.

    Being public (`AllowAny`, no authentication class — Stripe cannot carry a
    Firebase token) and exempt from the RLS middleware is exactly why: without
    verification, anyone who knows the URL could hand us a `customer.
    subscription.updated` and switch a plan on."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            # `request.body` before anything touches `request.data`: the
            # signature covers these exact bytes, and DRF's parsers consume
            # the stream.
            event = get_gateway().verify_webhook(request.body, request.headers.get("Stripe-Signature"))
        except (BillingUnavailable, ImproperlyConfigured):
            logger.error("Stripe webhook received but billing is not configured")
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            # No detail: the caller is either Stripe (which does not read it)
            # or someone probing, and "timestamp too old" versus "signature
            # mismatch" tells a prober which half to fix.
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(event, dict):
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)
        subscriptions.handle_event(event)
        return Response({"received": True})
