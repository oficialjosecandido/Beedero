"""Everything that talks to Stripe, behind eight calls.

`get_gateway()` returns the real Stripe gateway when STRIPE_SECRET_KEY is
set. Without a key it returns the stub only if BILLING_STRIPE_STUB is on
(local development and tests); in production a missing key is an error,
never a free plan.

Everything that comes back is a plain dict (`to_dict()`), so the rest of
billing reads Stripe objects and webhook payloads the same way.
"""

import json
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

from .models import StripeCustomer
from .plans import PLANS, price_id
from .webhook_signature import verify_signature


class BillingUnavailable(Exception):
    """Stripe is not configured; checkout cannot start."""


def _frontend(path: str) -> str:
    return f"{settings.FRONTEND_URL}{path}"


def checkout_urls(org) -> tuple[str, str]:
    success = _frontend(f"/dashboard/{org.slug}?checkout=success&session_id={{CHECKOUT_SESSION_ID}}")
    cancel = _frontend(f"/dashboard/{org.slug}?checkout=cancelled")
    return success, cancel


class StripeGateway:
    def __init__(self, secret_key: str):
        import stripe

        stripe.api_key = secret_key
        stripe.max_network_retries = 2
        self.stripe = stripe

    def ensure_customer(self, org, user) -> StripeCustomer:
        existing = StripeCustomer.objects.filter(org=org).first()
        if existing and not existing.provider_ref.startswith(("stub_", "cus_stub_")):
            return existing
        customer = self.stripe.Customer.create(
            name=org.name,
            email=user.email,
            metadata={"org_id": str(org.id), "org_slug": org.slug},
        )
        if existing:
            existing.provider_ref = customer.id
            existing.save(update_fields=["provider_ref"])
            return existing
        return StripeCustomer.objects.create(org=org, provider_ref=customer.id)

    def _price(self, kind: str, choice: str) -> str:
        price = price_id(kind, choice)
        if not price or price.startswith("price_stub_"):
            raise ImproperlyConfigured(f"{PLANS[(kind, choice)]['price_setting']} is not set.")
        return price

    def create_checkout_session(self, org, user, choice: str, trial_end=None) -> dict:
        price = self._price(org.kind, choice)
        customer = self.ensure_customer(org, user)
        success, cancel = checkout_urls(org)
        subscription_data = {"metadata": {"org_id": str(org.id), "org_slug": org.slug}}
        if trial_end is not None:
            subscription_data["trial_end"] = int(trial_end.timestamp())
        params = {
            "mode": "subscription",
            "customer": customer.provider_ref,
            "client_reference_id": str(org.id),
            "line_items": [{"price": price, "quantity": 1}],
            "subscription_data": subscription_data,
            "metadata": {"org_id": str(org.id), "org_slug": org.slug},
            "success_url": success,
            "cancel_url": cancel,
            # Invoices need the company's name, address and NIF.
            "billing_address_collection": "required",
            "tax_id_collection": {"enabled": True},
            "customer_update": {"name": "auto", "address": "auto"},
            "locale": "auto",
        }
        if getattr(settings, "STRIPE_AUTOMATIC_TAX", False):
            params["automatic_tax"] = {"enabled": True}
        session = self.stripe.checkout.Session.create(**params)
        return {"id": session.id, "url": session.url}

    def retrieve_checkout_session(self, session_id: str) -> dict:
        return self.stripe.checkout.Session.retrieve(session_id, expand=["subscription"]).to_dict()

    def retrieve_subscription(self, subscription_id: str) -> dict:
        return self.stripe.Subscription.retrieve(subscription_id).to_dict()

    def cancel_subscription(self, subscription_ref: str) -> None:
        """Ends the subscription now, not at the end of the period — the only
        caller is an organisation being deleted, which has nothing left to use
        the rest of the period for.

        A subscription Stripe no longer has is already the state we wanted, so
        `resource_missing` is not a failure.
        """
        try:
            self.stripe.Subscription.cancel(subscription_ref)
        except self.stripe.InvalidRequestError as err:
            if getattr(err, "code", "") != "resource_missing":
                raise

    def change_price(self, subscription_id: str, kind: str, choice: str) -> dict:
        """Move a subscription to another Price from its next renewal: no
        proration, no charge now, same billing date (same interval)."""
        price = self._price(kind, choice)
        current = self.stripe.Subscription.retrieve(subscription_id)
        item_id = current["items"]["data"][0]["id"]
        updated = self.stripe.Subscription.modify(
            subscription_id,
            items=[{"id": item_id, "price": price}],
            proration_behavior="none",
        )
        return updated.to_dict()

    def create_portal_session(self, customer_ref: str, return_url: str, configuration: str | None = None) -> str:
        params = {"customer": customer_ref, "return_url": return_url}
        if configuration:
            params["configuration"] = configuration
        return self.stripe.billing_portal.Session.create(**params).url

    def verify_webhook(self, payload: bytes, signature: str | None) -> dict:
        # Our own verifier rather than `stripe.WebhookSignature`: same scheme,
        # but it also refuses a timestamp from the future and is covered by
        # billing/test_stripe_webhook.py, which is where the rules for this
        # endpoint are written down.
        secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
        if not secret:
            raise ImproperlyConfigured("STRIPE_WEBHOOK_SECRET is not set.")
        verify_signature(payload, signature or "", secret)
        return json.loads(payload)


class StubGateway:
    """Local development and tests: no network. A checkout "completes" the
    moment it starts — the session id encodes what was bought, and the
    success URL brings the browser straight back to the workspace."""

    def ensure_customer(self, org, user) -> StripeCustomer:
        customer, _ = StripeCustomer.objects.get_or_create(org=org, defaults={"provider_ref": f"cus_stub_{org.id}"})
        return customer

    def create_checkout_session(self, org, user, choice: str, trial_end=None) -> dict:
        self.ensure_customer(org, user)
        trial = int(trial_end.timestamp()) if trial_end else 0
        session_id = f"cs_stub_{org.id}_{choice}_{trial}"
        success, _ = checkout_urls(org)
        return {"id": session_id, "url": success.replace("{CHECKOUT_SESSION_ID}", session_id)}

    def retrieve_checkout_session(self, session_id: str) -> dict:
        _, _, org_id, choice, trial = session_id.split("_", 4)
        return {
            "id": session_id,
            "mode": "subscription",
            "status": "complete",
            "customer": f"cus_stub_{org_id}",
            "client_reference_id": org_id,
            "metadata": {"org_id": org_id},
            "subscription": self._subscription(org_id, choice, int(trial)),
        }

    def _subscription(self, org_id: str, choice: str, trial: int, kind: str | None = None) -> dict:
        from orgs.models import Organization

        if kind is None:
            kind = Organization.objects.filter(pk=org_id).values_list("kind", flat=True).first() or "company"
        now = timezone.now()
        period = timedelta(days=365 if choice == "yearly" else 30)
        return {
            "id": f"sub_stub_{org_id}_{choice}",
            "object": "subscription",
            "status": "trialing" if trial else "active",
            "customer": f"cus_stub_{org_id}",
            "trial_end": trial or None,
            "cancel_at_period_end": False,
            "metadata": {"org_id": org_id},
            "items": {
                "data": [
                    {
                        "id": f"si_stub_{org_id}",
                        "price": {"id": price_id(kind, choice)},
                        "current_period_end": int((now + period).timestamp()),
                    }
                ]
            },
        }

    def retrieve_subscription(self, subscription_id: str) -> dict:
        _, _, org_id, choice = subscription_id.split("_", 3)
        return self._subscription(org_id, choice, 0)

    def cancel_subscription(self, subscription_ref: str) -> None:
        """Nothing to cancel: a stub subscription was never created anywhere."""

    def change_price(self, subscription_id: str, kind: str, choice: str) -> dict:
        """The same subscription, now on the other Price — status, trial and
        billing date as they were."""
        from .models import Subscription

        row = Subscription.objects.filter(provider_ref=subscription_id).first()
        org_id = str(row.org_id) if row else subscription_id.split("_")[2]
        data = self._subscription(org_id, choice, 0, kind=kind)
        data["id"] = subscription_id
        if row:
            data["status"] = row.status
            data["trial_end"] = int(row.trial_end.timestamp()) if row.trial_end else None
            data["cancel_at_period_end"] = row.cancel_at_period_end
            if row.current_period_end:
                data["items"]["data"][0]["current_period_end"] = int(row.current_period_end.timestamp())
        return data

    def create_portal_session(self, customer_ref: str, return_url: str, configuration: str | None = None) -> str:
        return return_url

    def verify_webhook(self, payload: bytes, signature: str | None) -> dict:
        return json.loads(payload)


def get_gateway():
    key = getattr(settings, "STRIPE_SECRET_KEY", "")
    if key:
        return StripeGateway(key)
    if getattr(settings, "BILLING_STRIPE_STUB", False):
        return StubGateway()
    raise BillingUnavailable("Payments are not configured.")
