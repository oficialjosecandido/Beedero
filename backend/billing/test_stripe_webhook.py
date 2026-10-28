"""The webhook endpoint is public and writes to the subscription state
machine, so these tests are about what it *refuses*.

What it does with an event it accepts is tested in test_subscriptions.py,
where the state machine itself lives."""

import json
import time

import pytest
from rest_framework.test import APIClient

from billing.models import Subscription
from billing.webhook_signature import (
    DEFAULT_TOLERANCE_SECONDS,
    SignatureError,
    sign_payload,
    verify_signature,
)
from orgs.models import Organization

URL = "/api/billing/stripe/webhook/"
SECRET = "whsec_test_secret"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def live_stripe(settings):
    """The real gateway, so the signature is actually checked. Tests otherwise
    run on the offline stub (conftest.py), which takes unsigned payloads."""
    settings.STRIPE_SECRET_KEY = "sk_test_x"
    settings.BILLING_STRIPE_STUB = False
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    return SECRET


@pytest.fixture
def subscription(db):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.DRAFT)
    return Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.ORG_YEARLY,
        status=Subscription.Status.PAST_DUE,
        provider_ref="sub_123",
    )


def event(event_type, obj, event_id="evt_1"):
    return {"id": event_id, "type": event_type, "data": {"object": obj}}


# --- signature verification ------------------------------------------------


def test_verify_accepts_its_own_signature():
    payload = b'{"id":"evt_1"}'
    verify_signature(payload, sign_payload(payload, SECRET), SECRET)


def test_verify_accepts_a_second_signature_during_rotation():
    payload = b'{"id":"evt_1"}'
    stamp = str(int(time.time()))
    good = sign_payload(payload, SECRET, timestamp=stamp).split(",")[1]
    header = f"t={stamp},v1=deadbeef,{good}"
    verify_signature(payload, header, SECRET)


@pytest.mark.parametrize(
    "header",
    [
        "",
        "nonsense",
        "t=1",
        "v1=deadbeef",
        "t=not-a-number,v1=deadbeef",
    ],
)
def test_verify_rejects_a_malformed_header(header):
    with pytest.raises(SignatureError):
        verify_signature(b"{}", header, SECRET)


def test_verify_rejects_a_signature_from_another_secret():
    payload = b'{"id":"evt_1"}'
    with pytest.raises(SignatureError):
        verify_signature(payload, sign_payload(payload, "whsec_other"), SECRET)


def test_verify_rejects_a_modified_payload():
    header = sign_payload(b'{"id":"evt_1"}', SECRET)
    with pytest.raises(SignatureError):
        verify_signature(b'{"id":"evt_2"}', header, SECRET)


def test_verify_rejects_a_replayed_timestamp():
    payload = b"{}"
    old = int(time.time()) - DEFAULT_TOLERANCE_SECONDS - 1
    with pytest.raises(SignatureError):
        verify_signature(payload, sign_payload(payload, SECRET, timestamp=old), SECRET)


def test_verify_rejects_a_future_timestamp():
    payload = b"{}"
    ahead = int(time.time()) + DEFAULT_TOLERANCE_SECONDS + 1
    with pytest.raises(SignatureError):
        verify_signature(payload, sign_payload(payload, SECRET, timestamp=ahead), SECRET)


def test_verify_fails_closed_without_a_secret():
    payload = b"{}"
    with pytest.raises(SignatureError):
        verify_signature(payload, sign_payload(payload, SECRET), "")


# --- the endpoint ----------------------------------------------------------


@pytest.mark.django_db
def test_unsigned_request_cannot_change_a_subscription(api, subscription, live_stripe):
    response = api.post(
        URL,
        data=event("customer.subscription.updated", {"id": "sub_123", "status": "active"}),
        format="json",
    )
    assert response.status_code == 400
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_forged_signature_cannot_change_a_subscription(api, subscription, live_stripe):
    body = json.dumps(event("customer.subscription.updated", {"id": "sub_123", "status": "active"})).encode()
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, "whsec_attacker")},
    )
    assert response.status_code == 400
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_endpoint_rejects_everything_when_no_secret_is_configured(api, subscription, live_stripe, settings):
    """Unconfigured is not the same as unverified: 503, never a write."""
    settings.STRIPE_WEBHOOK_SECRET = ""
    body = json.dumps(event("customer.subscription.updated", {"id": "sub_123", "status": "active"})).encode()
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 503
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_invalid_json_is_rejected(api, live_stripe):
    body = b"{not json"
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_non_object_payload_is_rejected(api, live_stripe):
    body = b'"just a string"'
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 400
