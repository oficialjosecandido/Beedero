from django.core.cache import cache
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from connections.models import Connection
from orgs.models import OrgFollow, Organization


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def alice(db):
    return User.objects.create_user(username="alice", email="alice@example.com", password="x")


@pytest.fixture
def bob(db):
    return User.objects.create_user(username="bob", email="bob@example.com", password="x")


@pytest.fixture
def carol(db):
    return User.objects.create_user(username="carol", email="carol@example.com", password="x")


def _connect(a, b):
    first, second = sorted([a, b], key=lambda u: u.id)
    return Connection.objects.create(user_one=first, user_two=second)


@pytest.mark.django_db
def test_connections_list_only_shows_viewers_own_connections(api, alice, bob, carol):
    _connect(alice, bob)
    _connect(bob, carol)

    api.force_authenticate(alice)
    res = api.get("/api/network/connections/")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["user"]["id"] == bob.id


@pytest.mark.django_db
def test_connections_list_filters_by_q(api, alice, bob, carol):
    _connect(alice, bob)
    _connect(alice, carol)

    api.force_authenticate(alice)
    res = api.get("/api/network/connections/", {"q": "bob"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert [item["user"]["id"] for item in items] == [bob.id]


@pytest.mark.django_db
def test_remove_connection_as_party_returns_204(api, alice, bob):
    connection = _connect(alice, bob)
    api.force_authenticate(alice)
    res = api.delete(f"/api/network/connections/{connection.id}/")
    assert res.status_code == 204
    assert not Connection.objects.filter(id=connection.id).exists()


@pytest.mark.django_db
def test_remove_connection_as_non_party_returns_404(api, alice, bob, carol):
    connection = _connect(alice, bob)
    api.force_authenticate(carol)
    res = api.delete(f"/api/network/connections/{connection.id}/")
    assert res.status_code == 404
    assert Connection.objects.filter(id=connection.id).exists()


@pytest.mark.django_db
def test_following_list_is_org_only(api, alice, bob):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgFollow.objects.create(user=alice, org=org)

    api.force_authenticate(alice)
    res = api.get("/api/network/following/")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["type"] == "org"
    assert items[0]["id"] == org.slug


@pytest.mark.django_db
def test_counts_match_direct_model_counts(api, alice, bob, carol):
    from connections.models import ConnectionRequest

    _connect(alice, bob)
    ConnectionRequest.objects.create(requester=carol, recipient=alice, note="hi")
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgFollow.objects.create(user=alice, org=org)

    api.force_authenticate(alice)
    res = api.get("/api/network/counts/")
    assert res.status_code == 200
    assert res.json() == {
        "connections": 1,
        "pending": 1,
        "following": 1,
    }
