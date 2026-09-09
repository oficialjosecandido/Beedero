from datetime import date

import pytest
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from notifications.models import Notification
from orgs.models import Organization, OrgMembership

from .models import InvestmentRecord
from .services import (
    DAILY_LIMIT_PER_ORG,
    backed_investors_summary,
    confirm_investment,
    declare_investment_as_investor,
    declare_investment_as_startup,
    dispute_investment,
    investor_portfolio,
    round_progress,
)


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", email="owner@example.com", password="x")


@pytest.fixture
def investor(db):
    return User.objects.create_user(username="investor", email="investor@example.com", password="x")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


@pytest.mark.django_db
def test_investor_declare_creates_declared_and_notifies_admins(org, owner, investor):
    record = declare_investment_as_investor(
        investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1)
    )
    assert record.status == InvestmentRecord.Status.DECLARED
    assert record.declarer_side == "investor"
    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.INVESTMENT_REQUEST, aggregate_key=f"investment_request:{record.id}"
    ).exists()


@pytest.mark.django_db
def test_startup_declare_with_investor_and_external_both_fails(org, owner, investor):
    with pytest.raises(ValidationError):
        declare_investment_as_startup(
            owner,
            org,
            investor_user=investor,
            investor_external_name="Some Fund",
            amount_cents=10_000_00,
            invested_on=date(2024, 1, 1),
        )
    with pytest.raises(ValidationError):
        declare_investment_as_startup(owner, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1))


@pytest.mark.django_db
def test_startup_declare_external_investor_notifies_nobody(org, owner):
    record = declare_investment_as_startup(
        owner, org, investor_external_name="Angel Fund", amount_cents=5_000_00, invested_on=date(2024, 1, 1)
    )
    assert record.status == InvestmentRecord.Status.DECLARED
    assert not Notification.objects.filter(kind=Notification.Kind.INVESTMENT_REQUEST).exists()


@pytest.mark.django_db
def test_daily_limit_per_org(org, investor):
    for _ in range(DAILY_LIMIT_PER_ORG):
        declare_investment_as_investor(investor, org, amount_cents=100, invested_on=date(2024, 1, 1))
    with pytest.raises(ValidationError):
        declare_investment_as_investor(investor, org, amount_cents=100, invested_on=date(2024, 1, 1))


@pytest.mark.django_db
def test_confirm_wrong_side_denied(org, owner, investor):
    record = declare_investment_as_investor(investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1))
    outsider = User.objects.create_user(username="outsider", email="outsider@example.com", password="x")
    with pytest.raises(PermissionDenied):
        confirm_investment(record, outsider)
    # the investor themself can't confirm their own declaration either
    with pytest.raises(PermissionDenied):
        confirm_investment(record, investor)


@pytest.mark.django_db
def test_confirm_by_org_member_succeeds_with_amount_public_and_notification(org, owner, investor):
    record = declare_investment_as_investor(
        investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1), amount_public_intent=True
    )
    record = confirm_investment(record, owner, amount_public_intent=True)
    assert record.status == InvestmentRecord.Status.CONFIRMED
    assert record.confirmed_by_id == owner.id
    assert record.amount_public is True
    notif = Notification.objects.get(kind=Notification.Kind.INVESTMENT_UPDATE, user=investor)
    assert "confirmed" in notif.body
    assert notif.payload.get("suggestion_title")


@pytest.mark.django_db
def test_amount_public_requires_both_intents(org, owner, investor):
    record = declare_investment_as_investor(
        investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1), amount_public_intent=True
    )
    record = confirm_investment(record, owner, amount_public_intent=False)
    assert record.amount_public is False


@pytest.mark.django_db
def test_startup_declared_investor_confirms_sets_investor_public(org, owner, investor):
    record = declare_investment_as_startup(
        owner, org, investor_user=investor, amount_cents=20_000_00, invested_on=date(2024, 1, 1)
    )
    assert record.investor_public is False
    record = confirm_investment(record, investor, investor_public_intent=True)
    assert record.investor_public is True
    assert record.status == InvestmentRecord.Status.CONFIRMED


@pytest.mark.django_db
def test_external_investor_record_cannot_be_confirmed(org, owner):
    record = declare_investment_as_startup(
        owner, org, investor_external_name="Angel Fund", amount_cents=5_000_00, invested_on=date(2024, 1, 1)
    )
    with pytest.raises(ValidationError):
        confirm_investment(record, owner)


@pytest.mark.django_db
def test_dispute_wrong_side_denied_and_right_side_disputes(org, owner, investor):
    record = declare_investment_as_investor(investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1))
    with pytest.raises(PermissionDenied):
        dispute_investment(record, investor)
    record = dispute_investment(record, owner)
    assert record.status == InvestmentRecord.Status.DISPUTED
    notif = Notification.objects.get(kind=Notification.Kind.INVESTMENT_UPDATE, user=investor)
    assert "disputed" in notif.body
    assert notif.payload == {}


@pytest.mark.django_db
def test_round_progress_only_counts_confirmed(org, owner, investor):
    r1 = declare_investment_as_investor(investor, org, amount_cents=10_000_00, invested_on=date(2024, 1, 1))
    confirm_investment(r1, owner)
    declare_investment_as_investor(investor, org, amount_cents=3_000_00, invested_on=date(2024, 1, 1))

    progress = round_progress(org, None)
    assert progress["confirmed_amount_cents"] == 10_000_00
    assert progress["declared_amount_cents"] == 3_000_00
    assert progress["confirmed_count"] == 1
    assert progress["declared_count"] == 1


@pytest.mark.django_db
def test_backed_investors_summary_redacts_names_without_consent(org, owner, investor):
    record = declare_investment_as_investor(
        investor, org, amount_cents=1_000_00, invested_on=date(2024, 1, 1), investor_public_intent=False
    )
    confirm_investment(record, owner)
    summary = backed_investors_summary(org)
    assert summary["backed_investors_count"] == 1
    assert summary["backed_investors"] == []


@pytest.mark.django_db
def test_investor_portfolio_excludes_non_public_and_non_confirmed(org, owner, investor):
    from accounts.models import InvestorProfile

    InvestorProfile.objects.create(user=investor, full_name="Jane Investor", handle="jane")

    public_record = declare_investment_as_investor(
        investor,
        org,
        amount_cents=1_000_00,
        invested_on=date(2024, 1, 1),
        investor_public_intent=True,
        amount_public_intent=True,
    )
    confirm_investment(public_record, owner, amount_public_intent=True)

    private_record = declare_investment_as_investor(
        investor, org, amount_cents=2_000_00, invested_on=date(2024, 1, 2), investor_public_intent=False
    )
    confirm_investment(private_record, owner)

    declare_investment_as_investor(
        investor, org, amount_cents=3_000_00, invested_on=date(2024, 1, 3), investor_public_intent=True
    )  # left declared, never confirmed

    items = investor_portfolio("jane")
    assert len(items) == 1
    assert items[0]["amount_cents"] == 1_000_00


@pytest.mark.django_db
def test_investment_record_requires_xor_investor_identity(org):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            InvestmentRecord.objects.create(
                org=org, amount_cents=100, invested_on=date(2024, 1, 1), declarer_side="startup"
            )
