"""The combined badge endpoint that replaced three client-side polls."""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User
from connections.models import Connection, ConnectionRequest
from messaging.models import Conversation, Message
from notifications.models import Notification
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


def _conversation(a, b):
    first, second = sorted([a, b], key=lambda u: u.id)
    return Conversation.objects.create(participant_one=first, participant_two=second)


@pytest.mark.django_db
def test_badges_requires_authentication(api):
    assert api.get("/api/me/badges/").status_code in (401, 403)


@pytest.mark.django_db
def test_badges_returns_every_counter(api, alice, bob):
    Notification.objects.create(
        user=alice, kind=Notification.Kind.MENTION, aggregate_key="a", title="t", body="b"
    )
    Notification.objects.create(
        user=alice, kind=Notification.Kind.MENTION, aggregate_key="b", title="t", body="b"
    )
    conversation = _conversation(alice, bob)
    Message.objects.create(conversation=conversation, sender=bob, body="hi")

    first, second = sorted([alice, bob], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)
    ConnectionRequest.objects.create(
        requester=bob, recipient=alice, status=ConnectionRequest.Status.PENDING
    )
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgFollow.objects.create(user=alice, org=org)

    api.force_authenticate(alice)
    res = api.get("/api/me/badges/")
    assert res.status_code == 200
    assert res.json() == {
        "notifications": {"unread_count": 2},
        "messages": {"unread_count": 1},
        "network": {"connections": 1, "pending": 1, "following": 1},
    }


@pytest.mark.django_db
def test_badges_are_scoped_to_the_caller(api, alice, bob):
    Notification.objects.create(
        user=bob, kind=Notification.Kind.MENTION, aggregate_key="a", title="t", body="b"
    )
    conversation = _conversation(alice, bob)
    # Alice's own message is not unread *for her*.
    Message.objects.create(conversation=conversation, sender=alice, body="hi")

    api.force_authenticate(alice)
    assert api.get("/api/me/badges/").json() == {
        "notifications": {"unread_count": 0},
        "messages": {"unread_count": 0},
        "network": {"connections": 0, "pending": 0, "following": 0},
    }


@pytest.mark.django_db
def test_badges_agree_with_the_dedicated_endpoints(api, alice, bob):
    """The combined endpoint exists to save requests, not to be a second
    source of truth — a drift here is the bug it could introduce."""
    Notification.objects.create(
        user=alice, kind=Notification.Kind.COMMENT, aggregate_key="a", title="t", body="b"
    )
    conversation = _conversation(alice, bob)
    Message.objects.create(conversation=conversation, sender=bob, body="hi")
    ConnectionRequest.objects.create(
        requester=bob, recipient=alice, status=ConnectionRequest.Status.PENDING
    )

    api.force_authenticate(alice)
    combined = api.get("/api/me/badges/").json()
    assert combined["notifications"] == api.get("/api/notifications/unread-count/").json()
    assert combined["messages"] == api.get("/api/messaging/unread-count/").json()
    assert combined["network"] == api.get("/api/network/counts/").json()
