import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs.models import Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_public_sitemap_lists_live_orgs_and_complete_profiles(api):
    Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    Organization.objects.create(slug="draft-co", name="Draft", status=Organization.Status.DRAFT)
    verified = Organization.objects.create(
        slug="verified-co", name="Verified Co", status=Organization.Status.LIVE, is_verified=True
    )

    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(
        user=user,
        handle="ada",
        full_name="Ada Lovelace",
        headline="Investor",
        country="PT",
    )
    User.objects.create_user(username="incomplete", email="incomplete@example.com", password="x")

    res = api.get("/api/public/sitemap/")
    assert res.status_code == 200
    data = res.json()
    assert {entry["slug"] for entry in data["orgs"]} == {"acme", "verified-co"}
    assert data["people"] == [{"handle": "ada", "lastmod": user.date_joined.date().isoformat()}]
    assert data["verify"] == [
        {"slug": verified.slug, "lastmod": verified.created_at.date().isoformat()}
    ]


@pytest.mark.django_db
def test_public_discovery_is_unauthenticated_and_paginated(api):
    for i in range(3):
        Organization.objects.create(
            slug=f"org{i}", name=f"Org {i}", status=Organization.Status.LIVE
        )

    res = api.get("/api/public/discovery/?limit=2&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    assert data["total"] == 3
    assert data["items"][0]["slug"]
