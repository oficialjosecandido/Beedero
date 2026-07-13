import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import FundraiseRound, OrgMembership, Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def member(db, org):
    user = User.objects.create_user(username="member", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
    return user


@pytest.mark.django_db
def test_reopening_after_close_creates_a_new_round_instead_of_reusing_the_old_one(api, org, owner):
    api.force_authenticate(owner)

    res = api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "seed", "ask_amount": 100}, format="json")
    assert res.status_code == 201
    first_id = res.data["id"]

    close_res = api.post(f"/api/orgs/{org.slug}/rounds/close/", {"raised_amount": 90}, format="json")
    assert close_res.status_code == 204

    res = api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "series_a", "ask_amount": 500}, format="json")
    assert res.status_code == 201
    second_id = res.data["id"]

    assert second_id != first_id
    assert FundraiseRound.objects.filter(org=org).count() == 2

    first_round = FundraiseRound.objects.get(pk=first_id)
    assert first_round.is_open is False
    assert first_round.raised_amount == 90
    assert first_round.stage == "seed"


@pytest.mark.django_db
def test_history_endpoint_lists_all_rounds_newest_first(api, org, owner):
    api.force_authenticate(owner)
    api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "pre_seed", "ask_amount": 50}, format="json")
    api.post(f"/api/orgs/{org.slug}/rounds/close/", {"raised_amount": 40}, format="json")
    res = api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "seed", "ask_amount": 200}, format="json")
    assert res.status_code == 201

    res = api.get(f"/api/orgs/{org.slug}/rounds/")
    assert res.status_code == 200
    assert [r["stage"] for r in res.data] == ["seed", "pre_seed"]
    assert res.data[1]["raised_amount"] == 40
    assert res.data[0]["is_open"] is True
    assert res.data[0]["closed_at"] is None


@pytest.mark.django_db
def test_plain_member_can_view_history_but_not_open_a_round(api, org, member):
    api.force_authenticate(member)
    res = api.get(f"/api/orgs/{org.slug}/rounds/")
    assert res.status_code == 200

    res = api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "seed"}, format="json")
    assert res.status_code == 403


@pytest.mark.django_db
def test_cannot_open_a_second_round_while_one_is_open(api, org, owner):
    api.force_authenticate(owner)
    api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "seed", "ask_amount": 100}, format="json")

    res = api.post(f"/api/orgs/{org.slug}/rounds/", {"stage": "series_a", "ask_amount": 500}, format="json")
    assert res.status_code == 400
