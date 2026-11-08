"""Startups and companies (orgs/kinds.py): the price, the ladder, the tools,
and what happens when a startup becomes a company."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from billing.access import org_billing_state
from billing.models import BillingAgreement, PromoCode, Subscription
from billing.plans import price_text
from billing.subscriptions import reprice, reprice_due, sync_stripe_subscription
from billing.testing import grant_plan
from cofounder.models import CofounderMatch
from credibility.models import Verification, VerificationType
from credibility.services import approve_verification
from investments.services import declare_investment_as_investor
from jobs.models import CompensationKind, EngagementType, JobPost
from jobs.services import create_job, update_job
from nexus.models import NexusAction
from notifications.models import Notification
from orgs.constants import FUNDRAISE_KINDS, SectionKind
from orgs.kinds import change_kind
from orgs.ladder import org_verification_ladder
from orgs.models import Organization, OrgMembership, OrgSection
from orgs.testing import unlock_org


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    user = User.objects.create_user(
        username="rita", email="rita@example.com", password="x"
    )
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    return user


def make_org(owner, kind, slug="tidal", **fields):
    org = Organization.objects.create(
        slug=slug,
        name=slug.title(),
        kind=kind,
        status=Organization.Status.LIVE,
        **fields,
    )
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


def onboard(api, user, **extra):
    api.force_authenticate(user)
    body = {"kind": "startup", "name": "Tidal", "plan": "yearly", "accept_terms": True}
    body.update(extra)
    return api.post("/api/org-onboarding/", body, format="json")


def stripe_row(org, plan, *, status="active", ref="sub_tidal"):
    return Subscription.objects.create(
        org=org,
        plan=plan,
        status=status,
        source=Subscription.Source.CHECKOUT,
        provider_ref=ref,
        current_period_end=timezone.now() + timedelta(days=20),
    )


# ------------------------------------------------------------------ price


@pytest.mark.django_db
def test_organisations_created_before_the_split_are_companies():
    assert Organization.objects.create(slug="old", name="Old").kind == "company"


@pytest.mark.django_db
def test_onboarding_asks_what_the_organisation_is(api, owner):
    response = onboard(api, owner, kind="")
    assert response.status_code == 400
    assert "kind" in response.json()
    response = onboard(api, owner, kind=None)
    assert response.status_code == 400
    assert not Organization.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("kind", "plan", "expected"),
    [
        ("startup", "yearly", "startup_yearly"),
        ("startup", "monthly", "startup_monthly"),
        ("company", "yearly", "org_yearly"),
        ("company", "monthly", "org_monthly"),
    ],
)
def test_the_kind_sets_the_plan_paid_for(api, owner, kind, plan, expected):
    response = onboard(api, owner, kind=kind, plan=plan)
    assert response.status_code == 201
    org = Organization.objects.get(slug=response.json()["slug"])
    assert org.kind == kind
    assert BillingAgreement.objects.get(org=org).plan == expected
    # Stripe (the stub) brings the browser back; the subscription is on the kind's price.
    api.post(
        f"/api/orgs/{org.slug}/billing/sync/",
        {"session_id": response.json()["url"].split("session_id=")[1]},
        format="json",
    )
    assert Subscription.objects.get(org=org).plan == expected


@pytest.mark.django_db
def test_earlyadopter_gives_a_startup_its_free_year_on_the_startup_plan(api, owner):
    response = onboard(api, owner, code="EARLYADOPTER")
    assert response.json()["next"] == "workspace"
    sub = Subscription.objects.get(org__slug=response.json()["slug"])
    assert (sub.plan, sub.source, sub.promo_code) == (
        "startup_yearly",
        "promo",
        PromoCode.objects.get(code="EARLYADOPTER"),
    )


@pytest.mark.django_db
def test_billing_shows_the_prices_of_the_organisations_kind(api, owner):
    startup = make_org(owner, "startup")
    company = make_org(owner, "company", slug="lumen")
    api.force_authenticate(owner)
    body = api.get(f"/api/orgs/{startup.slug}/billing/").json()
    assert body["kind"] == "startup"
    assert [(p["choice"], p["amount_cents"]) for p in body["prices"]] == [
        ("yearly", 3300),
        ("monthly", 300),
    ]
    body = api.get(f"/api/orgs/{company.slug}/billing/").json()
    assert [(p["choice"], p["amount_cents"]) for p in body["prices"]] == [
        ("yearly", 9900),
        ("monthly", 900),
    ]
    assert price_text("startup") == "€33/year or €3/month"


@pytest.mark.django_db
def test_an_organisation_from_a_cofounder_match_is_a_startup(api, owner):
    """Two people who have just met to build something have no company yet,
    so the co-founder button links to /orgs/new?kind=startup
    (components/cofounder/CreateOrgFromMatch.tsx). The form still asks, so a
    pair who already incorporated can say otherwise — which is why this is
    checked here, on the way in, and not forced in cofounder/services.py."""
    other = User.objects.create_user(
        username="zed", email="zed@example.com", password="x"
    )
    a, b = sorted([owner, other], key=lambda user: user.id)
    match = CofounderMatch.objects.create(user_a=a, user_b=b)

    response = onboard(api, owner, kind="startup", match=match.id)
    assert response.status_code == 201

    org = Organization.objects.get(slug=response.json()["slug"])
    match.refresh_from_db()
    assert (org.kind, match.org_id) == ("startup", org.id)


# ----------------------------------------------------------------- ladder


@pytest.mark.django_db
def test_a_startups_ladder_has_no_registry_and_the_gate_is_still_half(owner):
    org = unlock_org(make_org(owner, "startup"))
    ladder = org_verification_ladder(org)
    keys = [rung["key"] for rung in ladder["rungs"]]
    assert "registry_confirmed" not in keys
    assert ladder["total_count"] == 7
    assert ladder["kind"] == "startup"
    assert ladder["done_count"] == 4
    assert ladder["percent"] == 50
    beedero = next(
        rung for rung in ladder["rungs"] if rung["key"] == "beedero_verified"
    )
    assert beedero["pending"] is True  # in the Nexus queue

    org.is_verified = True
    org.save(update_fields=["is_verified"])
    ladder = org_verification_ladder(org)
    assert (ladder["done_count"], ladder["percent"]) == (5, 66)


@pytest.mark.django_db
def test_a_companys_ladder_is_unchanged(owner):
    org = unlock_org(make_org(owner, "company"))
    ladder = org_verification_ladder(org)
    assert ladder["total_count"] == 8
    assert "registry_confirmed" in [rung["key"] for rung in ladder["rungs"]]
    assert ladder["percent"] == 50
    org.is_verified = True
    org.save(update_fields=["is_verified"])
    assert org_verification_ladder(org)["percent"] == 62  # 5 of 8, floored


@pytest.mark.django_db
def test_a_startup_before_the_gate_is_not_in_the_queue(owner):
    org = make_org(owner, "startup")
    beedero = next(
        r
        for r in org_verification_ladder(org)["rungs"]
        if r["key"] == "beedero_verified"
    )
    assert beedero["pending"] is False


# ------------------------------------------------------------------- jobs


def job(**overrides):
    kwargs = dict(
        title="Co-founder, CTO",
        description="Build it with us.",
        engagement_type=EngagementType.COFOUNDER,
        location_type=JobPost.LocationType.REMOTE,
        compensation_kinds=[{"kind": CompensationKind.EQUITY, "detail": "20%"}],
    )
    kwargs.update(overrides)
    return kwargs


@pytest.mark.django_db
def test_co_founder_roles_are_for_startups(owner):
    startup = unlock_org(make_org(owner, "startup"))
    assert create_job(startup, created_by=owner, **job()).engagement_type == "cofounder"

    company = unlock_org(make_org(owner, "company", slug="lumen"))
    with pytest.raises(ValidationError) as caught:
        create_job(company, created_by=owner, **job())
    assert "engagement_type" in caught.value.detail


@pytest.mark.django_db
def test_stock_options_need_a_company(owner):
    startup = unlock_org(make_org(owner, "startup"))
    with pytest.raises(ValidationError) as caught:
        create_job(
            startup,
            created_by=owner,
            **job(
                engagement_type=EngagementType.FULL_TIME,
                compensation_kinds=[{"kind": "stock_options"}],
            ),
        )
    assert "compensation" in caught.value.detail
    company = unlock_org(make_org(owner, "company", slug="lumen"))
    created = create_job(
        company,
        created_by=owner,
        **job(
            engagement_type=EngagementType.FULL_TIME,
            compensation_kinds=[{"kind": "stock_options"}],
        ),
    )
    assert list(created.compensation.values_list("kind", flat=True)) == [
        "stock_options"
    ]


@pytest.mark.django_db
def test_a_role_posted_before_a_change_of_kind_can_still_be_edited(owner):
    org = unlock_org(make_org(owner, "startup"))
    posted = create_job(org, created_by=owner, **job())
    Organization.objects.filter(pk=org.pk).update(kind="company")
    posted.refresh_from_db()
    updated = update_job(
        posted, title="Co-founder, CTO (Lisbon)", engagement_type="cofounder"
    )
    assert updated.title == "Co-founder, CTO (Lisbon)"
    # Moving it away and back is a new co-founder role, which a company can't post.
    update_job(posted, engagement_type="full_time")
    with pytest.raises(ValidationError):
        update_job(posted, engagement_type="cofounder")


# ------------------------------------------------------------ fundraising


@pytest.mark.django_db
def test_a_startup_raises_pre_seed_without_a_valuation(api, owner):
    org = make_org(owner, "startup")
    grant_plan(org)  # opening a round needs a plan (billing/access.py)
    api.force_authenticate(owner)
    response = api.post(
        f"/api/orgs/{org.slug}/rounds/",
        {"stage": "seed", "ask_amount": 100},
        format="json",
    )
    assert response.status_code == 400 and "stage" in response.json()
    response = api.post(
        f"/api/orgs/{org.slug}/rounds/",
        {"stage": "pre_seed", "ask_amount": 100, "valuation": 1000},
        format="json",
    )
    assert response.status_code == 400 and "valuation" in response.json()
    response = api.post(
        f"/api/orgs/{org.slug}/rounds/",
        {"stage": "pre_seed", "ask_amount": 100},
        format="json",
    )
    assert response.status_code == 201
    open_kinds = set(
        OrgSection.objects.filter(
            org=org, kind__in=FUNDRAISE_KINDS, archived_at__isnull=True
        ).values_list("kind", flat=True)
    )
    assert open_kinds == {SectionKind.ASK, SectionKind.USE_OF_FUNDS}


@pytest.mark.django_db
def test_a_round_opened_as_a_startup_gains_the_company_sections(
    api, owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "startup")
    grant_plan(org)
    api.force_authenticate(owner)
    api.post(
        f"/api/orgs/{org.slug}/rounds/",
        {"stage": "pre_seed", "ask_amount": 100},
        format="json",
    )
    org.refresh_from_db()
    with django_capture_on_commit_callbacks(execute=True):
        change_kind(org, "company", reason="Registry confirmed")
    open_kinds = set(
        OrgSection.objects.filter(
            org=org, kind__in=FUNDRAISE_KINDS, archived_at__isnull=True
        ).values_list("kind", flat=True)
    )
    assert open_kinds == set(FUNDRAISE_KINDS)


@pytest.mark.django_db
def test_investments_are_recorded_once_the_startup_is_a_company(owner):
    org = make_org(owner, "startup")
    investor = User.objects.create_user(
        username="ivo", email="ivo@example.com", password="x"
    )
    with pytest.raises(ValidationError):
        declare_investment_as_investor(
            investor, org, amount_cents=10_000_00, invested_on=timezone.now().date()
        )
    org.kind = "company"
    org.save(update_fields=["kind"])
    record = declare_investment_as_investor(
        investor, org, amount_cents=10_000_00, invested_on=timezone.now().date()
    )
    assert record.status == "declared"


# --------------------------------------------------------- becoming a company


@pytest.mark.django_db
def test_a_confirmed_registry_makes_the_startup_a_company(
    owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "startup")
    reviewer = User.objects.create_user(
        username="staffer", email="staff@beedero.test", password="x", is_staff=True
    )
    verification = Verification.objects.create(
        org=org,
        type=VerificationType.COMPANY_REGISTRY,
        submitted_by=owner,
        payload={"nif": "501234567"},
    )
    with django_capture_on_commit_callbacks(execute=True):
        approve_verification(verification, reviewer)
    org.refresh_from_db()
    assert org.kind == "company"
    assert org.kind_changed_at is not None
    action = NexusAction.objects.get(action="org.kind", target_id=org.slug)
    assert (action.actor, action.reason, action.data) == (
        reviewer,
        "Registry confirmed",
        {"kind": "company", "previous": "startup"},
    )
    note = Notification.objects.get(user=owner, kind=Notification.Kind.BILLING)
    assert note.title == "Tidal is now a company"
    # The ladder gains the registry rung, already done.
    registry = next(
        r
        for r in org_verification_ladder(org)["rungs"]
        if r["key"] == "registry_confirmed"
    )
    assert registry["done"] is True


@pytest.mark.django_db
def test_changing_to_the_same_kind_does_nothing(owner):
    org = make_org(owner, "company")
    assert change_kind(org, "company", reason="x") is False
    assert not NexusAction.objects.exists()


@pytest.mark.django_db
def test_a_free_year_moves_to_the_new_price_at_once(
    owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "startup")
    Subscription.objects.create(
        org=org,
        plan="startup_monthly",
        status="trialing",
        source="promo",
        trial_end=timezone.now() + timedelta(days=100),
    )
    with django_capture_on_commit_callbacks(execute=True):
        change_kind(org, "company", reason="Registry confirmed")
    assert Subscription.objects.get(org=org).plan == "org_monthly"
    assert org_billing_state(org)["plan_kind"] == "company"


@pytest.mark.django_db
def test_a_higher_price_waits_30_days_after_the_change(
    owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "startup")
    sub = stripe_row(org, "startup_yearly")
    with django_capture_on_commit_callbacks(execute=True):
        change_kind(org, "company", reason="Registry confirmed")
    sub.refresh_from_db()
    assert sub.plan == "startup_yearly"
    note = Notification.objects.get(user=owner, kind=Notification.Kind.BILLING)
    assert "first renewal after" in note.body

    assert reprice_due(timezone.now() + timedelta(days=29)) == {
        "repriced": 0,
        "waiting": 1,
        "failed": 0,
    }
    sub.refresh_from_db()
    assert sub.plan == "startup_yearly"

    assert reprice_due(timezone.now() + timedelta(days=31)) == {
        "repriced": 1,
        "waiting": 0,
        "failed": 0,
    }
    sub.refresh_from_db()
    assert (sub.plan, sub.status, sub.provider_ref) == (
        "org_yearly",
        "active",
        "sub_tidal",
    )
    assert reprice_due(timezone.now() + timedelta(days=32))["repriced"] == 0


@pytest.mark.django_db
def test_a_lower_price_applies_from_the_next_renewal(
    owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "company")
    sub = stripe_row(org, "org_monthly", status="past_due")
    with django_capture_on_commit_callbacks(execute=True):
        change_kind(org, "startup", reason="Not incorporated yet")
    sub.refresh_from_db()
    assert (sub.plan, sub.status) == ("startup_monthly", "past_due")
    note = Notification.objects.get(user=owner, kind=Notification.Kind.BILLING)
    assert note.title == "Tidal is now a startup"
    assert "next renewal" in note.body


@pytest.mark.django_db
def test_a_company_paying_a_startup_price_is_moved_back(owner):
    """A subscription that arrives on the other kind's price (say, switched in
    Stripe's portal) is put right by the daily job."""
    org = make_org(owner, "company")
    Organization.objects.filter(pk=org.pk).update(
        created_at=timezone.now() - timedelta(days=90)
    )
    org.refresh_from_db()
    data = {
        "id": "sub_tidal",
        "status": "active",
        "metadata": {"org_id": str(org.id)},
        "items": {"data": [{"price": {"id": "price_stub_startup_yearly"}}]},
    }
    sub = sync_stripe_subscription(data)
    assert sub.plan == "startup_yearly"
    assert reprice(org) == "stripe"
    sub.refresh_from_db()
    assert sub.plan == "org_yearly"


# --------------------------------------------------------------- discover


@pytest.mark.django_db
def test_discover_filters_by_kind(api, owner):
    unlock_org(make_org(owner, "startup"))
    unlock_org(make_org(owner, "company", slug="lumen"))
    api.force_authenticate(owner)

    def slugs(kind):
        return [
            item["slug"]
            for item in api.get(f"/api/discovery/?kind={kind}").json()["items"]
        ]

    assert slugs("startup") == ["tidal"]
    assert slugs("company") == ["lumen"]
    assert (
        api.get("/api/discovery/?kind=startup").json()["items"][0]["kind"] == "startup"
    )


@pytest.mark.django_db
def test_the_plan_screen_says_when_the_company_price_starts(
    api, owner, django_capture_on_commit_callbacks
):
    org = make_org(owner, "startup")
    stripe_row(org, "startup_monthly")
    api.force_authenticate(owner)
    assert api.get(f"/api/orgs/{org.slug}/billing/").json()["price_change"] is None
    with django_capture_on_commit_callbacks(execute=True):
        change_kind(org, "company", reason="Registry confirmed")
    body = api.get(f"/api/orgs/{org.slug}/billing/").json()
    assert (body["kind"], body["plan_kind"], body["plan"]) == (
        "company",
        "startup",
        "monthly",
    )
    org.refresh_from_db()
    assert body["price_change"] == {
        "kind": "company",
        "from": (org.kind_changed_at + timedelta(days=30)).isoformat(),
    }
    assert [p["amount_cents"] for p in body["prices"]] == [9900, 900]


@pytest.mark.django_db
def test_the_portal_uses_the_kinds_configuration(api, owner, settings, monkeypatch):
    from billing.models import StripeCustomer
    from billing.subscriptions import portal_url

    org = make_org(owner, "startup")
    StripeCustomer.objects.create(org=org, provider_ref="cus_tidal")
    settings.STRIPE_PORTAL_CONFIGURATION_STARTUP = "bpc_startup"
    seen = {}

    class Gateway:
        def create_portal_session(self, customer_ref, return_url, configuration=None):
            seen["configuration"] = configuration
            return "https://billing.stripe.test/session"

    monkeypatch.setattr("billing.subscriptions.get_gateway", lambda: Gateway())
    assert portal_url(org) == "https://billing.stripe.test/session"
    assert seen["configuration"] == "bpc_startup"
