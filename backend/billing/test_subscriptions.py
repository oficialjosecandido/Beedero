"""Organisation subscriptions: the onboarding page, EARLYADOPTER, checkout,
the Stripe webhook, reminders, and what an organisation without a plan can
no longer do."""

import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from billing.access import has_access, org_billing_state
from billing.models import BillingAgreement, PaidInvoice, PromoCode, StripeCustomer, StripeEvent, Subscription
from billing.plans import TERMS_VERSION
from billing.subscriptions import grant_launch_year, send_free_period_reminders
from notifications.models import Notification
from orgs.ladder import listed_in_discover
from orgs.models import Organization, OrgMembership
from orgs.testing import unlock_org


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    user = User.objects.create_user(username="ana", email="ana@example.com", password="x")
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    return user


def onboard(api, user, **extra):
    api.force_authenticate(user)
    body = {"name": "Lumen Credit", "one_liner": "Credit for small shops.", "plan": "yearly", "accept_terms": True}
    body.update(extra)
    return api.post("/api/org-onboarding/", body, format="json")


def session_id_from(url: str) -> str:
    return url.split("session_id=")[1]


def free_org(owner, slug="lumen", days_left=200):
    org = Organization.objects.create(slug=slug, name=slug.title())
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.ORG_YEARLY,
        status=Subscription.Status.TRIALING,
        source=Subscription.Source.PROMO,
        promo_code=PromoCode.objects.get(code="EARLYADOPTER"),
        trial_end=timezone.now() + timedelta(days=days_left),
    )
    return org


def stripe_subscription(org, *, status="active", price="price_stub_yearly", ref="sub_123", **extra):
    data = {
        "id": ref,
        "object": "subscription",
        "status": status,
        "customer": "cus_123",
        "cancel_at_period_end": False,
        "trial_end": None,
        "metadata": {"org_id": str(org.id)},
        "items": {"data": [{"price": {"id": price}, "current_period_end": int(time.time()) + 3600 * 24 * 365}]},
    }
    data.update(extra)
    return data


def event(kind, obj, event_id="evt_1"):
    return {"id": event_id, "type": kind, "data": {"object": obj}}


# ------------------------------------------------------------- the code


@pytest.mark.django_db
def test_earlyadopter_is_there_from_the_migration():
    code = PromoCode.objects.get(code="EARLYADOPTER")
    assert code.active and code.free_days == 365


@pytest.mark.django_db
def test_codes_are_checked_case_insensitively(api, owner):
    api.force_authenticate(owner)
    assert api.get("/api/billing/codes/earlyadopter/").json() == {
        "valid": True,
        "code": "EARLYADOPTER",
        "free_days": 365,
    }
    assert api.get("/api/billing/codes/NOPE/").json()["valid"] is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"active": False}, "doesn't exist"),
        ({"expires_at": timezone.now() - timedelta(days=1)}, "expired"),
        ({"max_redemptions": 0}, "used up"),
    ],
)
def test_a_code_can_be_switched_off_expire_or_run_out(api, owner, change, message):
    PromoCode.objects.filter(code="EARLYADOPTER").update(**change)
    response = onboard(api, owner, code="EARLYADOPTER")
    assert response.status_code == 400
    assert message in response.json()["code"][0]
    assert not Organization.objects.exists()


# ------------------------------------------------------- the onboarding


@pytest.mark.django_db
def test_with_the_code_the_organisation_is_ready_with_a_free_year_and_no_stripe(api, owner):
    response = onboard(api, owner, code="earlyadopter", stage="seed", sector="fintech", geo="PT")
    assert response.status_code == 201
    body = response.json()
    assert body["next"] == "workspace"
    assert body["url"] == f"/dashboard/{body['slug']}?welcome=1"

    org = Organization.objects.get(slug=body["slug"])
    assert (org.stage, org.sector, org.geo) == ("seed", "fintech", "PT")
    assert org.status == Organization.Status.DRAFT
    assert OrgMembership.objects.get(org=org).role == OrgMembership.Role.OWNER
    sub = Subscription.objects.get(org=org)
    assert (sub.status, sub.source, sub.provider_ref) == ("trialing", "promo", "")
    assert abs((sub.trial_end - timezone.now()) - timedelta(days=365)) < timedelta(minutes=1)
    assert not StripeCustomer.objects.filter(org=org).exists()
    agreement = BillingAgreement.objects.get(org=org)
    assert (agreement.user, agreement.terms_version, agreement.plan) == (owner, TERMS_VERSION, "org_yearly")
    state = org_billing_state(org)
    assert state["state"] == "free_year" and state["has_access"] is True
    assert state["promo_code"] == "EARLYADOPTER"


@pytest.mark.django_db
def test_the_terms_must_be_accepted(api, owner):
    response = onboard(api, owner, accept_terms=False)
    assert response.status_code == 400
    assert "accept_terms" in response.json()
    assert not Organization.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(("plan", "expected"), [("yearly", "org_yearly"), ("monthly", "org_monthly")])
def test_without_a_code_the_browser_goes_to_checkout_and_comes_back_paid(api, owner, plan, expected):
    response = onboard(api, owner, plan=plan)
    body = response.json()
    assert body["next"] == "checkout"
    org = Organization.objects.get(slug=body["slug"])
    assert org_billing_state(org)["state"] == "needs_plan"
    assert has_access(org) is False

    synced = api.post(
        f"/api/orgs/{org.slug}/billing/sync/", {"session_id": session_id_from(body["url"])}, format="json"
    ).json()
    assert synced["state"] == "active"
    assert synced["managed_by_stripe"] is True
    sub = Subscription.objects.get(org=org)
    assert (sub.plan, sub.status, sub.source) == (expected, "active", "checkout")
    assert StripeCustomer.objects.get(org=org).provider_ref == f"cus_stub_{org.id}"


@pytest.mark.django_db
def test_a_checkout_cannot_be_claimed_by_another_organisation(api, owner):
    mine = onboard(api, owner).json()
    other = onboard(api, owner, name="Tidal").json()
    response = api.post(
        f"/api/orgs/{other['slug']}/billing/sync/", {"session_id": session_id_from(mine["url"])}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_one_free_year_per_organisation(api, owner):
    org = free_org(owner)
    api.force_authenticate(owner)
    response = api.post(f"/api/orgs/{org.slug}/billing/redeem/", {"code": "EARLYADOPTER"}, format="json")
    assert response.status_code == 400
    assert "already had its free year" in response.json()["code"][0]


@pytest.mark.django_db
def test_an_abandoned_checkout_can_still_use_the_code(api, owner):
    slug = onboard(api, owner).json()["slug"]
    response = api.post(f"/api/orgs/{slug}/billing/redeem/", {"code": "EARLYADOPTER", "plan": "monthly"}, format="json")
    assert response.status_code == 200
    assert response.json()["state"] == "free_year"
    assert response.json()["plan"] == "monthly"


@pytest.mark.django_db
def test_without_stripe_configured_nothing_is_given_away(api, owner, settings):
    settings.BILLING_STRIPE_STUB = False
    body = onboard(api, owner).json()
    assert body["next"] == "workspace"
    org = Organization.objects.get(slug=body["slug"])
    assert has_access(org) is False
    response = api.post(f"/api/orgs/{org.slug}/billing/checkout/", {"plan": "yearly"}, format="json")
    assert response.status_code == 503


# ------------------------------------------ adding a card in the free year


@pytest.mark.django_db
def test_a_card_added_during_the_free_year_is_first_charged_when_it_ends(api, owner):
    org = free_org(owner, days_left=100)
    free_end = Subscription.objects.get(org=org).trial_end
    api.force_authenticate(owner)
    url = api.post(f"/api/orgs/{org.slug}/billing/checkout/", {"plan": "yearly"}, format="json").json()["url"]
    session_id = session_id_from(url)
    assert session_id.endswith(f"_{int(free_end.timestamp())}")  # trial_end sent to Stripe

    state = api.post(f"/api/orgs/{org.slug}/billing/sync/", {"session_id": session_id}, format="json").json()
    assert state["state"] == "trialing"
    stripe_row = Subscription.objects.get(org=org, source="checkout")
    assert int(stripe_row.trial_end.timestamp()) == int(free_end.timestamp())
    assert Subscription.objects.get(org=org, source="promo").status == "canceled"
    assert has_access(org) is True


@pytest.mark.django_db
def test_a_free_year_about_to_end_goes_straight_to_payment(api, owner):
    org = free_org(owner, days_left=1)
    api.force_authenticate(owner)
    url = api.post(f"/api/orgs/{org.slug}/billing/checkout/", {"plan": "monthly"}, format="json").json()["url"]
    assert session_id_from(url).endswith("_0")  # under 48h: no trial, Stripe charges now


@pytest.mark.django_db
def test_only_owners_and_admins_handle_billing(api, owner):
    org = free_org(owner)
    member = User.objects.create_user(username="bob", email="bob@example.com", password="x")
    OrgMembership.objects.create(org=org, user=member, role=OrgMembership.Role.MEMBER)
    api.force_authenticate(member)
    assert api.get(f"/api/orgs/{org.slug}/billing/").status_code == 200
    assert api.post(f"/api/orgs/{org.slug}/billing/checkout/", {}, format="json").status_code == 403
    assert api.post(f"/api/orgs/{org.slug}/billing/portal/", {}, format="json").status_code == 403


# ---------------------------------------------------------------- webhook


def signed(payload: dict, secret="whsec_test"):
    body = json.dumps(payload)
    timestamp = int(time.time())
    signature = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    return body, f"t={timestamp},v1={signature}"


@pytest.mark.django_db
def test_the_webhook_refuses_unsigned_or_badly_signed_events(api, owner, settings):
    settings.STRIPE_SECRET_KEY = "sk_test_x"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test"
    org = free_org(owner)
    body, _ = signed(event("customer.subscription.updated", stripe_subscription(org)))
    bad = api.post("/api/billing/stripe/webhook/", body, content_type="application/json", HTTP_STRIPE_SIGNATURE="t=1,v1=x")
    assert bad.status_code == 400
    assert not Subscription.objects.filter(provider_ref="sub_123").exists()


@pytest.mark.django_db
def test_a_signed_event_is_applied_once(api, owner, settings):
    settings.STRIPE_SECRET_KEY = "sk_test_x"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test"
    settings.STRIPE_PRICE_MONTHLY = "price_monthly_live"
    org = free_org(owner)
    payload = event("customer.subscription.created", stripe_subscription(org, price="price_monthly_live"))
    body, header = signed(payload)
    first = api.post("/api/billing/stripe/webhook/", body, content_type="application/json", HTTP_STRIPE_SIGNATURE=header)
    assert first.status_code == 200
    sub = Subscription.objects.get(provider_ref="sub_123")
    assert (sub.org, sub.plan, sub.status) == (org, "org_monthly", "active")
    assert StripeCustomer.objects.get(org=org).provider_ref == "cus_123"

    sub.status = "past_due"
    sub.save()
    api.post("/api/billing/stripe/webhook/", body, content_type="application/json", HTTP_STRIPE_SIGNATURE=header)
    assert Subscription.objects.get(provider_ref="sub_123").status == "past_due"  # not re-applied
    assert StripeEvent.objects.filter(event_id="evt_1").count() == 1


@pytest.mark.django_db
def test_checkout_completed_links_the_subscription(api, owner):
    org = Organization.objects.create(slug="acme", name="Acme")
    session = {
        "id": "cs_1",
        "mode": "subscription",
        "status": "complete",
        "client_reference_id": str(org.id),
        "metadata": {"org_id": str(org.id)},
        "customer": "cus_123",
        "subscription": stripe_subscription(org, ref="sub_9", metadata={}),
    }
    response = api.post(
        "/api/billing/stripe/webhook/", json.dumps(event("checkout.session.completed", session)), content_type="application/json"
    )
    assert response.status_code == 200
    assert Subscription.objects.get(provider_ref="sub_9").org == org


@pytest.mark.django_db
def test_past_due_keeps_the_lights_on_and_canceled_switches_them_off(api, owner):
    org = unlock_org(Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE), with_plan=False)
    api.post(
        "/api/billing/stripe/webhook/",
        json.dumps(event("customer.subscription.updated", stripe_subscription(org, status="past_due"))),
        content_type="application/json",
    )
    assert org_billing_state(org)["state"] == "past_due"
    assert list(listed_in_discover(Organization.objects.all())) == [org]

    api.post(
        "/api/billing/stripe/webhook/",
        json.dumps(event("customer.subscription.deleted", stripe_subscription(org, status="canceled"), "evt_2")),
        content_type="application/json",
    )
    assert org_billing_state(org)["state"] == "lapsed"
    assert list(listed_in_discover(Organization.objects.all())) == []


@pytest.mark.django_db
def test_paid_invoices_become_faturas_to_issue_and_free_ones_do_not(api, owner):
    org = free_org(owner)
    StripeCustomer.objects.create(org=org, provider_ref="cus_123")
    invoice = {
        "id": "in_1",
        "customer": "cus_123",
        "number": "BEE-0001",
        "amount_paid": 9900,
        "currency": "eur",
        "customer_name": "Lumen Credit, Lda",
        "customer_tax_ids": [{"type": "eu_vat", "value": "PT503504564"}],
        "status_transitions": {"paid_at": int(time.time())},
    }
    api.post("/api/billing/stripe/webhook/", json.dumps(event("invoice.paid", invoice)), content_type="application/json")
    row = PaidInvoice.objects.get(stripe_invoice_id="in_1")
    assert (row.org, row.amount_paid_cents, row.customer_tax_ids, row.fatura_reference) == (
        org,
        9900,
        "eu_vat PT503504564",
        "",
    )
    free = {**invoice, "id": "in_2", "amount_paid": 0}
    api.post("/api/billing/stripe/webhook/", json.dumps(event("invoice.paid", free, "evt_2")), content_type="application/json")
    assert not PaidInvoice.objects.filter(stripe_invoice_id="in_2").exists()


@pytest.mark.django_db
def test_a_failed_payment_tells_the_owners(api, owner):
    org = free_org(owner)
    StripeCustomer.objects.create(org=org, provider_ref="cus_123")
    api.post(
        "/api/billing/stripe/webhook/",
        json.dumps(event("invoice.payment_failed", {"id": "in_3", "customer": "cus_123"})),
        content_type="application/json",
    )
    note = Notification.objects.get(user=owner, kind=Notification.Kind.BILLING)
    assert note.title == f"Payment failed for {org.name}"


# ------------------------------------------------- without a plan, nothing new


@pytest.fixture
def lapsed(owner):
    org = unlock_org(
        Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE),
        person=owner,
        with_plan=False,
    )
    Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.ORG_YEARLY,
        status=Subscription.Status.TRIALING,
        source=Subscription.Source.LAUNCH,
        trial_end=timezone.now() - timedelta(minutes=1),  # ended; the job has not run yet
    )
    return org


@pytest.mark.django_db
def test_a_lapsed_organisation_cannot_post_or_publish_jobs(api, owner, lapsed):
    api.force_authenticate(owner)
    post = api.post(
        f"/api/orgs/{lapsed.slug}/posts/", {"kind": "update", "title": "Hello", "body": "News"}, format="json"
    )
    assert post.status_code == 402
    assert post.json()["code"] == "plan_required"
    job = api.post(
        f"/api/orgs/{lapsed.slug}/jobs/",
        {
            "title": "Engineer",
            "description": "Build things",
            "engagement_type": "full_time",
            "location_type": "remote",
            "compensation_kinds": [],
        },
        format="json",
    )
    assert job.status_code == 402


@pytest.mark.django_db
def test_a_lapsed_organisation_is_hidden_from_discover_but_keeps_its_page(api, owner, lapsed):
    assert list(listed_in_discover(Organization.objects.all())) == []
    assert api.get(f"/api/public/orgs/{lapsed.slug}/").status_code == 200


@pytest.mark.django_db
def test_publishing_needs_a_plan(api, owner):
    org = unlock_org(Organization.objects.create(slug="acme", name="Acme"), person=owner, with_plan=False)
    api.force_authenticate(owner)
    response = api.post(f"/api/orgs/{org.slug}/activate/")
    assert response.status_code == 402


# -------------------------------------------------------------- reminders


@pytest.mark.django_db
def test_reminders_go_out_once_per_threshold(owner):
    org = free_org(owner, days_left=20)
    assert send_free_period_reminders()["reminded"] == 1
    assert send_free_period_reminders()["reminded"] == 1  # counted, but…
    assert Notification.objects.filter(user=owner, kind=Notification.Kind.BILLING).count() == 1  # …sent once

    Subscription.objects.filter(org=org).update(trial_end=timezone.now() + timedelta(days=5, hours=1))
    send_free_period_reminders()
    assert Notification.objects.filter(user=owner, kind=Notification.Kind.BILLING).count() == 2


@pytest.mark.django_db
def test_an_ended_free_year_is_paused_and_the_owners_told(owner):
    org = free_org(owner, days_left=0)
    Subscription.objects.filter(org=org).update(trial_end=timezone.now() - timedelta(hours=1))
    assert send_free_period_reminders()["paused"] == 1
    assert Subscription.objects.get(org=org).status == "paused"
    assert org_billing_state(org)["state"] == "lapsed"
    assert Notification.objects.filter(user=owner, title__contains="free year has ended").exists()


@pytest.mark.django_db
def test_the_workspace_flags_a_free_year_in_its_last_month(owner):
    assert org_billing_state(free_org(owner, slug="a", days_left=200))["ending_soon"] is False
    assert org_billing_state(free_org(owner, slug="b", days_left=20))["ending_soon"] is True


# --------------------------------------------------------------- launch


@pytest.mark.django_db
def test_the_launch_year_counts_as_the_free_year(api, owner):
    org = Organization.objects.create(slug="acme", name="Acme")
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    grant_launch_year(org)
    assert org_billing_state(org)["state"] == "free_year"
    api.force_authenticate(owner)
    response = api.post(f"/api/orgs/{org.slug}/billing/redeem/", {"code": "EARLYADOPTER"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_beederos_own_organisation_is_complimentary(api, owner):
    api.force_authenticate(owner)
    api.get("/api/feed/")
    beedero = Organization.objects.get(slug="beedero")
    assert org_billing_state(beedero)["state"] == "comp"
