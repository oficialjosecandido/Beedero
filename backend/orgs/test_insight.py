import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from analytics.models import InterestSignal, ProfileView
from orgs.constants import SectionKind
from orgs.models import Organization, OrgMembership, RestrictedAccessLog


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", email="founder@acme.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def named_investor(db):
    user = User.objects.create_user(username="inv1", email="inv1@example.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="Jane Investor")
    return user


@pytest.fixture
def anonymous_investor(db):
    return User.objects.create_user(username="inv2", email="inv2@example.com", password="x")


@pytest.mark.django_db
def test_insight_never_exposes_investor_email(api, org, founder, named_investor, anonymous_investor):
    ProfileView.objects.create(org=org, viewer=named_investor, viewer_is_investor=True)
    ProfileView.objects.create(org=org, viewer=anonymous_investor, viewer_is_investor=True)
    InterestSignal.objects.create(org=org, investor=named_investor, kind=InterestSignal.Kind.SAVED)
    RestrictedAccessLog.objects.create(
        viewer=anonymous_investor, org=org, field_key="cap_table", section_kind=SectionKind.DATA_ROOM
    )

    api.force_authenticate(founder)
    res = api.get(f"/api/orgs/{org.slug}/insight/")
    assert res.status_code == 200

    body = res.data
    raw_text = str(body)
    assert named_investor.email not in raw_text
    assert anonymous_investor.email not in raw_text

    viewer_names = {v["investor"] for v in body["viewers"]}
    assert viewer_names == {"Jane Investor", "Investor"}

    signal_names = {s["investor"] for s in body["interest_signals"]}
    assert signal_names == {"Jane Investor"}

    opens_names = {o["investor"] for o in body["dataroom_opens"]}
    assert opens_names == {"Investor"}


@pytest.mark.django_db
def test_insight_counts_are_always_present(api, org, founder, named_investor):
    ProfileView.objects.create(org=org, viewer=named_investor)

    api.force_authenticate(founder)
    res = api.get(f"/api/orgs/{org.slug}/insight/")
    assert res.status_code == 200
    assert res.data["profile_views_count"] == 1
    assert res.data["interest_signals_count"] == 0
    assert res.data["dataroom_opens_count"] == 0


@pytest.mark.django_db
def test_insight_forbidden_for_non_owner(api, org, anonymous_investor):
    api.force_authenticate(anonymous_investor)
    res = api.get(f"/api/orgs/{org.slug}/insight/")
    assert res.status_code == 403
