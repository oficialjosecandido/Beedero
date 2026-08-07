from django.core.cache import cache
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from messaging.models import Conversation, OrgConversation, UserBlock
from notifications.models import Notification
from orgs.models import Organization, OrgMembership

from .models import Connection, ConnectionRequest, OrgConnectionRequest
from .services import (
    accept_org_request,
    accept_request,
    can_message_directly,
    decline_request,
    send_request,
)


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


@pytest.fixture
def org(db, alice):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=alice, role=OrgMembership.Role.OWNER)
    return org


@pytest.mark.django_db
def test_send_request_creates_pending_request_and_notification(api, alice, bob):
    req = send_request(alice, bob, note="Hi Bob")
    assert req.status == ConnectionRequest.Status.PENDING
    assert req.note == "Hi Bob"
    assert Notification.objects.filter(user=bob, kind=Notification.Kind.CONNECTION_REQUEST).exists()


@pytest.mark.django_db
def test_send_request_blocked_by_block(alice, bob):
    UserBlock.objects.create(blocker=bob, blocked=alice)
    with pytest.raises(Exception):
        send_request(alice, bob)


@pytest.mark.django_db
def test_send_request_rejects_duplicate_pending(alice, bob):
    send_request(alice, bob)
    with pytest.raises(Exception):
        send_request(alice, bob)


@pytest.mark.django_db
def test_send_request_rejects_when_already_connected(alice, bob):
    first, second = sorted([alice, bob], key=lambda u: u.id)
    Connection.objects.create(user_one=first, user_two=second)
    with pytest.raises(Exception):
        send_request(alice, bob)


@pytest.mark.django_db
def test_send_request_enforces_daily_rate_limit(alice):
    for i in range(3):
        target = User.objects.create_user(username=f"t{i}", email=f"t{i}@example.com", password="x")
        send_request(alice, target)
    extra = User.objects.create_user(username="extra", email="extra@example.com", password="x")
    with pytest.raises(Exception):
        send_request(alice, extra)


@pytest.mark.django_db
def test_accept_request_with_note_creates_connection_and_opens_conversation(alice, bob):
    req = send_request(alice, bob, note="Hi Bob")
    connection, conversation = accept_request(req, bob)
    assert connection is not None
    assert can_message_directly(alice, bob) is True
    assert conversation is not None
    assert Conversation.objects.filter(pk=conversation.pk).exists()
    first_message = conversation.messages.order_by("created_at").first()
    assert first_message.body == "Hi Bob"
    assert first_message.sender_id == alice.id
    assert Notification.objects.filter(user=alice, kind=Notification.Kind.CONNECTION_ACCEPTED).exists()


@pytest.mark.django_db
def test_accept_request_without_note_creates_connection_but_no_conversation(alice, bob):
    req = send_request(alice, bob)
    connection, conversation = accept_request(req, bob)
    assert connection is not None
    assert conversation is None


@pytest.mark.django_db
def test_only_recipient_can_accept(alice, bob, carol):
    req = send_request(alice, bob)
    with pytest.raises(Exception):
        accept_request(req, carol)


@pytest.mark.django_db
def test_decline_request_is_silent(alice, bob):
    req = send_request(alice, bob)
    decline_request(req, bob)
    req.refresh_from_db()
    assert req.status == ConnectionRequest.Status.DECLINED
    assert not Notification.objects.filter(user=alice, kind=Notification.Kind.CONNECTION_ACCEPTED).exists()


@pytest.mark.django_db
def test_connection_request_endpoint_and_accept_flow(api, alice, bob):
    api.force_authenticate(alice)
    res = api.post("/api/connections/requests/", {"recipient_id": bob.id, "note": "Hi"}, format="json")
    assert res.status_code == 201
    req_id = res.data["id"]

    api.force_authenticate(bob)
    pending = api.get("/api/connections/requests/pending/")
    assert pending.status_code == 200
    assert [item["id"] for item in pending.data["items"]] == [req_id]

    accept = api.post(f"/api/connections/requests/{req_id}/accept/")
    assert accept.status_code == 200
    assert accept.data["conversation"]["id"] is not None


@pytest.mark.django_db
def test_non_participant_gets_404_on_accept(api, alice, bob, carol):
    req = send_request(alice, bob)
    api.force_authenticate(carol)
    res = api.post(f"/api/connections/requests/{req.id}/accept/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_org_accept_requires_admin_role(api, org, bob):
    """The requester themself is a valid caller (view-level check passes),
    but accept_org_request still refuses since a USER-initiated request
    needs an org admin, not the requester, to accept."""
    req = OrgConnectionRequest.objects.create(
        org=org,
        requester=bob,
        initiated_by=OrgConnectionRequest.InitiatedBy.USER,
        created_by=bob,
        note="Hi Acme",
    )
    api.force_authenticate(bob)
    res = api.post(f"/api/orgs/{org.slug}/connections/requests/{req.id}/accept/")
    assert res.status_code == 403


@pytest.mark.django_db
def test_org_accept_404s_for_unrelated_user(api, org, bob, carol):
    req = OrgConnectionRequest.objects.create(
        org=org,
        requester=bob,
        initiated_by=OrgConnectionRequest.InitiatedBy.USER,
        created_by=bob,
        note="Hi Acme",
    )
    api.force_authenticate(carol)
    res = api.post(f"/api/orgs/{org.slug}/connections/requests/{req.id}/accept/")
    assert res.status_code == 404


@pytest.mark.django_db
def test_org_admin_can_accept_org_request(api, org, alice, bob):
    req = OrgConnectionRequest.objects.create(
        org=org,
        requester=bob,
        initiated_by=OrgConnectionRequest.InitiatedBy.USER,
        created_by=bob,
        note="Hi Acme",
    )
    api.force_authenticate(alice)
    res = api.post(f"/api/orgs/{org.slug}/connections/requests/{req.id}/accept/")
    assert res.status_code == 200
    assert res.data["conversation"]["id"] is not None
    conversation = OrgConversation.objects.get(pk=res.data["conversation"]["id"])
    first_message = conversation.messages.order_by("created_at").first()
    assert first_message.body == "Hi Acme"


@pytest.mark.django_db
def test_accept_org_request_service_creates_conversation(org, alice, bob):
    req = OrgConnectionRequest.objects.create(
        org=org,
        requester=bob,
        initiated_by=OrgConnectionRequest.InitiatedBy.USER,
        created_by=bob,
        note="Hi Acme",
    )
    conversation = accept_org_request(req, alice)
    assert conversation is not None
    req.refresh_from_db()
    assert req.status == OrgConnectionRequest.Status.ACCEPTED
