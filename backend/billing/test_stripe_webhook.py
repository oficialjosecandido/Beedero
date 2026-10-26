"""The webhook endpoint is public and writes to the subscription state
machine, so these tests are mostly about what it *refuses*."""

import json
import time

import pytest
from rest_framework.test import APIClient

from billing.models import ProcessedWebhookEvent, Subscription
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


@pytest.fixture(autouse=True)
def secret(settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    return SECRET


@pytest.fixture
def subscription(db):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.DRAFT)
    return Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.FOUNDER_PRO,
        status=Subscription.Status.PAST_DUE,
        provider_ref="sub_123",
    )


def event(event_type, obj, event_id="evt_1"):
    return {"id": event_id, "type": event_type, "data": {"object": obj}}


def post(api, payload, *, header=None, timestamp=None):
    body = json.dumps(payload).encode()
    if header is None:
        header = sign_payload(body, SECRET, timestamp=timestamp)
    return api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": header} if header else {},
    )


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
def test_unsigned_request_cannot_change_a_subscription(api, subscription):
    response = api.post(
        URL,
        data=event("customer.subscription.updated", {"id": "sub_123", "status": "active"}),
        format="json",
    )
    assert response.status_code == 400
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_forged_signature_cannot_change_a_subscription(api, subscription):
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
def test_endpoint_rejects_everything_when_no_secret_is_configured(api, subscription, settings):
    settings.STRIPE_WEBHOOK_SECRET = ""
    body = json.dumps(event("customer.subscription.updated", {"id": "sub_123", "status": "active"})).encode()
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 400
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_signed_update_applies(api, subscription):
    response = post(api, event("customer.subscription.updated", {"id": "sub_123", "status": "active"}))
    assert response.status_code == 200
    assert response.json() == {"received": True, "handled": True}
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.ACTIVE


@pytest.mark.django_db
def test_signed_delete_cancels(api, subscription):
    response = post(api, event("customer.subscription.deleted", {"id": "sub_123"}))
    assert response.status_code == 200
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.CANCELED


@pytest.mark.django_db
def test_redelivery_of_the_same_event_is_dropped(api, subscription):
    payload = event("customer.subscription.updated", {"id": "sub_123", "status": "active"})
    assert post(api, payload).json()["handled"] is True

    subscription.status = Subscription.Status.PAST_DUE
    subscription.save(update_fields=["status"])

    second = post(api, payload)
    assert second.status_code == 200
    assert second.json() == {"received": True, "duplicate": True}
    subscription.refresh_from_db()
    # Still past_due: the handler did not run a second time.
    assert subscription.status == Subscription.Status.PAST_DUE
    assert ProcessedWebhookEvent.objects.filter(event_id="evt_1").count() == 1


@pytest.mark.django_db
def test_unhandled_event_type_is_acknowledged_but_not_recorded(api, subscription):
    response = post(api, event("invoice.payment_failed", {"id": "sub_123", "status": "active"}))
    assert response.status_code == 200
    assert response.json() == {"received": True, "handled": False}
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE
    assert not ProcessedWebhookEvent.objects.exists()


@pytest.mark.django_db
def test_status_outside_the_model_choices_is_ignored(api, subscription):
    # Stripe has statuses this column does not declare (`trialing`,
    # `incomplete`, ...) — writing one through would poison entitlements.
    response = post(api, event("customer.subscription.updated", {"id": "sub_123", "status": "trialing"}))
    assert response.status_code == 200
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_missing_event_id_is_rejected(api, subscription):
    payload = {"type": "customer.subscription.updated", "data": {"object": {"id": "sub_123", "status": "active"}}}
    response = post(api, payload)
    assert response.status_code == 400
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE


@pytest.mark.django_db
def test_non_object_payload_is_rejected(api):
    body = b'"just a string"'
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_json_is_rejected(api):
    body = b"{not json"
    response = api.post(
        URL,
        data=body,
        content_type="application/json",
        headers={"Stripe-Signature": sign_payload(body, SECRET)},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_an_unknown_subscription_is_a_noop(api):
    response = post(api, event("customer.subscription.updated", {"id": "sub_nope", "status": "active"}))
    assert response.status_code == 200
    assert not Subscription.objects.exists()
