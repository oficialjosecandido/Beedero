"""The Nexus and the two kinds of organisation: the startups waiting for
Beedero's confirmation, changing the kind, and revenue by kind."""

import pytest

from billing.models import Subscription
from nexus.billing import revenue_summary
from nexus.models import NexusAction
from orgs.models import Organization, OrgMembership
from orgs.testing import unlock_org


@pytest.fixture
def owner(make_user):
    return make_user("rita")


def org(owner, slug, kind, **fields):
    created = Organization.objects.create(
        slug=slug, name=slug.title(), kind=kind, status="live", **fields
    )
    OrgMembership.objects.create(org=created, user=owner, role=OrgMembership.Role.OWNER)
    return created


@pytest.mark.django_db
def test_startups_past_the_gate_wait_for_beederos_confirmation(as_staff, owner):
    waiting = unlock_org(org(owner, "tidal", "startup"))
    org(owner, "early", "startup")  # not past the gate yet
    unlock_org(org(owner, "lumen", "company"))
    unlock_org(org(owner, "done", "startup", is_verified=True))

    assert as_staff.get("/api/nexus/home/").json()["queues"]["startups_to_confirm"] == 1
    rows = as_staff.get("/api/nexus/orgs/?filter=to_confirm").json()["results"]
    assert [row["slug"] for row in rows] == [waiting.slug]
    assert rows[0]["kind"] == "startup"
    assert {
        row["slug"]
        for row in as_staff.get("/api/nexus/orgs/?filter=startups").json()["results"]
    } == {
        "tidal",
        "early",
        "done",
    }
    assert [
        row["slug"]
        for row in as_staff.get("/api/nexus/orgs/?filter=companies").json()["results"]
    ] == ["lumen"]


@pytest.mark.django_db
def test_an_admin_confirms_a_startup(as_admin, owner):
    tidal = unlock_org(org(owner, "tidal", "startup"))
    body = as_admin.post(
        "/api/nexus/orgs/tidal/verify/",
        {"value": True, "reason": "Spoke with both founders."},
        format="json",
    ).json()
    assert body["is_verified"] is True
    beedero = next(
        rung for rung in body["ladder"]["rungs"] if rung["key"] == "beedero_verified"
    )
    assert (beedero["done"], beedero["pending"]) == (True, False)
    tidal.refresh_from_db()
    assert tidal.is_verified


@pytest.mark.django_db
def test_an_admin_changes_the_kind_and_it_is_audited(as_admin, admin, owner):
    org(owner, "tidal", "company")
    response = as_admin.post(
        "/api/nexus/orgs/tidal/kind/",
        {"value": "startup", "reason": "No company yet — told us by email."},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["kind"] == "startup"
    assert response.json()["ladder"]["total_count"] == 7
    action = NexusAction.objects.get(action="org.kind")
    assert (action.actor, action.data) == (
        admin,
        {"kind": "startup", "previous": "company"},
    )
    assert response.json()["history"][0]["action"] == "org.kind"

    again = as_admin.post(
        "/api/nexus/orgs/tidal/kind/",
        {"value": "startup", "reason": "x"},
        format="json",
    )
    assert again.status_code == 400
    wrong = as_admin.post(
        "/api/nexus/orgs/tidal/kind/",
        {"value": "charity", "reason": "x"},
        format="json",
    )
    assert wrong.status_code == 400


@pytest.mark.django_db
def test_staff_can_see_the_kind_but_not_change_it(as_staff, owner):
    org(owner, "tidal", "startup")
    assert as_staff.get("/api/nexus/orgs/tidal/").json()["kind"] == "startup"
    response = as_staff.post(
        "/api/nexus/orgs/tidal/kind/",
        {"value": "company", "reason": "x"},
        format="json",
    )
    assert response.status_code == 403
    assert Organization.objects.get(slug="tidal").kind == "startup"


@pytest.mark.django_db
def test_revenue_counts_each_kinds_price(owner):
    Subscription.objects.create(
        org=org(owner, "tidal", "startup"),
        plan="startup_yearly",
        status="active",
        source="checkout",
        provider_ref="s1",
    )
    Subscription.objects.create(
        org=org(owner, "lumen", "company"),
        plan="org_monthly",
        status="active",
        source="checkout",
        provider_ref="s2",
    )
    summary = revenue_summary()
    assert summary["mrr_cents"] == 275 + 900  # €33 a year is €2.75 a month
    assert (summary["paying_startups"], summary["paying_companies"]) == (1, 1)
    assert (summary["paying_yearly"], summary["paying_monthly"]) == (1, 1)
