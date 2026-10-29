"""The Overview, the nightly rollup (also under the real RLS role), revenue,
faturas and promo codes, and the audit log."""

from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.activity import local_day
from accounts.models import User
from affiliations.models import Affiliation
from analytics.models import UserActiveDay
from billing.models import PaidInvoice, PromoCode, Subscription
from connections.models import Connection, ConnectionRequest
from messaging.models import Conversation, Message
from nexus.billing import revenue_summary
from nexus.models import DailyPlatformStats, NexusAction
from nexus.rollup import compute, count_for_viewer
from orgs.models import Activity, Organization, OrgMembership, Visibility
from social.models import Comment, Reaction


def card(body, key):
    return next(c for section in body["sections"] for c in section["cards"] if c["key"] == key)


def connect(a, b):
    one, two = sorted([a, b], key=lambda u: u.id)
    return Connection.objects.create(user_one=one, user_two=two)


# ---------------------------------------------------------------- overview


@pytest.mark.django_db
def test_the_overview_counts_real_people_only(as_admin, make_user):
    make_user("ana")
    make_user("bob")
    make_user("tester", is_internal=True)  # plus the admin, who is staff
    body = as_admin.get("/api/nexus/overview/").json()
    assert card(body, "people_total")["value"] == 2
    assert card(body, "people_new_today")["value"] == 2
    assert {section["key"] for section in body["sections"]} >= {"today", "growth", "engagement", "revenue", "trust"}
    assert len(body["series"]["signups"]) == 30
    assert body["series"]["signups"][-1]["value"] == 2


@pytest.mark.django_db
def test_active_people_come_from_active_days(as_admin, make_user):
    ana, bob = make_user("ana"), make_user("bob")
    today = local_day(timezone.now())
    UserActiveDay.objects.create(user=ana, day=today)
    UserActiveDay.objects.create(user=bob, day=today - timedelta(days=3))
    body = as_admin.get("/api/nexus/overview/").json()
    assert (card(body, "dau")["value"], card(body, "wau")["value"], card(body, "mau")["value"]) == (1, 2, 2)


@pytest.mark.django_db
def test_the_north_star_counts_confirmations(as_admin, make_user):
    ana = make_user("ana")
    org = Organization.objects.create(slug="lumen", name="Lumen")
    started = timezone.now().date()
    Affiliation.objects.create(
        user=ana,
        org=org,
        role="employee",
        started_on=started,
        created_by=ana,
        status=Affiliation.Status.VERIFIED,
        verified_at=timezone.now(),
    )
    Affiliation.objects.create(
        user=make_user("old"),
        org=org,
        role="employee",
        started_on=started,
        created_by=ana,
        status=Affiliation.Status.VERIFIED,
        verified_at=timezone.now() - timedelta(days=10),
    )
    star = as_admin.get("/api/nexus/overview/").json()["north_star"]
    assert star["parts"]["roles"] == 1
    assert star["previous"] == 1


# ------------------------------------------------------------------ rollup


@pytest.fixture
def activity_world(make_user):
    ana, bob, cat = make_user("ana"), make_user("bob"), make_user("cat")
    tester = make_user("tester", is_internal=True)
    connect(ana, bob)
    connect(ana, tester)  # internal on one side: not counted
    ConnectionRequest.objects.create(requester=cat, recipient=ana)
    one, two = sorted([ana, bob], key=lambda u: u.id)
    conversation = Conversation.objects.create(participant_one=one, participant_two=two)
    Message.objects.create(conversation=conversation, sender=ana, body="Hi")
    Message.objects.create(conversation=conversation, sender=bob, body="Hello")
    org = Organization.objects.create(slug="lumen", name="Lumen", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=ana, role=OrgMembership.Role.OWNER)
    public = Activity.objects.create(org=org, author=ana, kind="news", title="A", occurred_at=timezone.now())
    Activity.objects.create(
        org=org, author=ana, kind="news", title="B", occurred_at=timezone.now(), visibility=Visibility.PRIVATE
    )
    Reaction.objects.create(activity=public, user=bob)
    Comment.objects.create(activity=public, author=cat, body="Nice")
    return {"ana": ana, "bob": bob, "cat": cat}


@pytest.mark.django_db
def test_the_rollup_counts_each_kind_once(activity_world):
    compute(days=2)
    today = DailyPlatformStats.objects.get(date=local_day(timezone.now()))
    assert (today.connections_new, today.connections_total) == (1, 1)
    assert (today.messages_new, today.reactions_new, today.comments_new, today.posts_new) == (2, 1, 1, 2)
    assert today.requests_pending == 1
    compute(days=2)  # idempotent
    assert DailyPlatformStats.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_the_rollup_works_under_row_level_security(db_app_role_connection, activity_world):
    """As the real `beedero_app` role, each person's own rows are exactly
    what the policies let the job count."""
    people = list(User.objects.filter(is_internal=False, is_staff=False).values_list("id", flat=True))
    since = timezone.now() - timedelta(days=1)
    with db_app_role_connection.transaction(), db_app_role_connection.cursor() as cursor:
        ana = count_for_viewer(cursor, activity_world["ana"].id, people, since)
        bob = count_for_viewer(cursor, activity_world["bob"].id, people, since)
    assert sum(ana["by_day"]["connections"].values()) + sum(bob["by_day"]["connections"].values()) == 1
    assert sum(ana["by_day"]["messages"].values()) == 1
    assert sum(ana["by_day"]["posts"].values()) == 2  # her members-only post included: she is a member
    assert sum(bob["by_day"]["reactions"].values()) == 1


@pytest.mark.django_db
def test_rollup_numbers_reach_the_overview(as_admin, activity_world):
    compute(days=7)
    body = as_admin.get("/api/nexus/overview/").json()
    assert card(body, "connections_7")["value"] == 1
    assert card(body, "messages_7")["value"] == 2
    assert body["rollup"]["fresh"] is True
    assert body["north_star"]["parts"]["connections"] == 1


# ----------------------------------------------------------------- billing


@pytest.mark.django_db
def test_mrr_counts_what_is_being_paid_now():
    def org(slug):
        return Organization.objects.create(slug=slug, name=slug)

    Subscription.objects.create(org=org("a"), plan="org_yearly", status="active", source="checkout", provider_ref="s1")
    Subscription.objects.create(org=org("b"), plan="org_monthly", status="past_due", source="checkout", provider_ref="s2")
    Subscription.objects.create(org=org("c"), plan="org_yearly", status="trialing", source="checkout", provider_ref="s3")
    Subscription.objects.create(org=org("d"), plan="comp", status="active", source="admin")
    summary = revenue_summary()
    assert summary["mrr_cents"] == 825 + 900
    assert summary["mrr_net_cents"] == round(1725 / 1.23)
    assert summary["paying_orgs"] == 2
    assert summary["card_on_file_in_free_year"] == 1
    assert summary["past_due"] == 1


@pytest.mark.django_db
def test_free_year_conversion():
    now = timezone.now()
    for slug, pays in [("a", True), ("b", False)]:
        org = Organization.objects.create(slug=slug, name=slug)
        Subscription.objects.create(
            org=org, plan="org_yearly", status="paused", source="promo", trial_end=now - timedelta(days=3)
        )
        if pays:
            Subscription.objects.create(org=org, plan="org_yearly", status="active", source="checkout", provider_ref=f"s{slug}")
    summary = revenue_summary(now)
    assert (summary["free_periods_ended_12m"], summary["free_periods_converted_12m"], summary["conversion_pct"]) == (2, 1, 50)


@pytest.mark.django_db
def test_recording_a_fatura(as_admin):
    org = Organization.objects.create(slug="a", name="A")
    invoice = PaidInvoice.objects.create(org=org, stripe_invoice_id="in_1", amount_paid_cents=9900, paid_at=timezone.now())
    body = as_admin.get("/api/nexus/billing/").json()
    assert [row["id"] for row in body["invoices_to_issue"]] == [invoice.id]
    assert as_admin.post(f"/api/nexus/billing/invoices/{invoice.id}/issue/", {}).status_code == 400
    as_admin.post(f"/api/nexus/billing/invoices/{invoice.id}/issue/", {"fatura_reference": "FR 2026/12"}, format="json")
    invoice.refresh_from_db()
    assert invoice.fatura_reference == "FR 2026/12" and invoice.fatura_issued_at
    assert as_admin.get("/api/nexus/billing/").json()["invoices_to_issue"] == []
    assert NexusAction.objects.filter(action="invoice.issued").exists()


@pytest.mark.django_db
def test_promo_codes(as_admin):
    created = as_admin.post(
        "/api/nexus/billing/promo-codes/", {"code": "websummit26", "free_days": 90, "max_redemptions": 50}, format="json"
    )
    assert created.status_code == 201 and created.json()["code"] == "WEBSUMMIT26"
    assert as_admin.post("/api/nexus/billing/promo-codes/", {"code": "WEBSUMMIT26"}, format="json").status_code == 400
    as_admin.patch("/api/nexus/billing/promo-codes/websummit26/", {"active": False}, format="json")
    assert PromoCode.objects.get(code="WEBSUMMIT26").active is False
    codes = {row["code"] for row in as_admin.get("/api/nexus/billing/").json()["promo_codes"]}
    assert {"EARLYADOPTER", "WEBSUMMIT26"} <= codes


# ------------------------------------------------------------------- audit


@pytest.mark.django_db
def test_the_audit_log_lists_and_filters(as_admin, admin, make_user):
    ana = make_user("ana")
    as_admin.post(f"/api/nexus/users/{ana.id}/internal/", {"value": True}, format="json")
    as_admin.post("/api/nexus/billing/promo-codes/", {"code": "TEST1"}, format="json")
    rows = as_admin.get("/api/nexus/audit/", {"action": "user."}).json()["results"]
    assert [(row["action"], row["actor"]) for row in rows] == [("user.internal", admin.email)]
