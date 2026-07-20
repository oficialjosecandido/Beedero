from django.core.cache import cache
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from notifications.models import Notification
from orgs.models import OrgMembership, Organization, UserFollow

from .models import Conversation, Message, OrgMessage
from .services import get_or_create_conversation, get_or_create_org_conversation
from .views import CONVERSATIONS_PER_DAY, MESSAGES_PER_HOUR


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


@pytest.mark.django_db
def test_message_contacts_lists_following_and_followers(api, alice, bob, carol):
    api.force_authenticate(alice)
    UserFollow.objects.create(follower=alice, followed=bob)
    UserFollow.objects.create(follower=carol, followed=alice)

    res = api.get("/api/contacts/")
    assert res.status_code == 200
    ids = {item["id"] for item in res.data["items"]}
    assert ids == {bob.id, carol.id}


@pytest.mark.django_db
def test_starting_a_conversation_twice_reuses_the_same_row(api, alice, bob):
    api.force_authenticate(alice)

    first = api.post("/api/conversations/", {"user_id": bob.id}, format="json")
    assert first.status_code == 201
    second = api.post("/api/conversations/", {"user_id": bob.id}, format="json")
    assert second.status_code == 201
    assert first.data["id"] == second.data["id"]
    assert Conversation.objects.count() == 1

    # Starting it from Bob's side finds the same ordered-pair row.
    api.force_authenticate(bob)
    third = api.post("/api/conversations/", {"user_id": alice.id}, format="json")
    assert third.data["id"] == first.data["id"]


@pytest.mark.django_db
def test_cannot_message_self(api, alice):
    api.force_authenticate(alice)
    res = api.post("/api/conversations/", {"user_id": alice.id}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_guard_non_participant_gets_404_never_403(api, alice, bob, carol):
    conversation = get_or_create_conversation(alice, bob)

    api.force_authenticate(carol)
    res = api.get(f"/api/conversations/{conversation.id}/messages/")
    assert res.status_code == 404

    res = api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hi"}, format="json")
    assert res.status_code == 404


@pytest.mark.django_db
def test_send_and_read_marks_unread_messages_read(api, alice, bob):
    conversation = get_or_create_conversation(alice, bob)

    api.force_authenticate(alice)
    sent = api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hey bob"}, format="json")
    assert sent.status_code == 201
    assert sent.data["is_mine"] is True

    # Before Bob opens the thread, Bob's conversation list shows 1 unread.
    api.force_authenticate(bob)
    listing = api.get("/api/conversations/")
    assert listing.data["items"][0]["unread_count"] == 1

    api.get(f"/api/conversations/{conversation.id}/messages/")  # opens the thread -> marks read
    message = Message.objects.get(conversation=conversation)
    assert message.read_at is not None

    listing_after = api.get("/api/conversations/")
    assert listing_after.data["items"][0]["unread_count"] == 0


@pytest.mark.django_db
def test_conversation_list_includes_last_message_preview(api, alice, bob):
    conversation = get_or_create_conversation(alice, bob)
    api.force_authenticate(alice)
    api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hey bob"}, format="json")

    listing = api.get("/api/conversations/")
    item = listing.data["items"][0]
    assert item["last_message"]["body"] == "hey bob"
    assert item["last_message"]["is_mine"] is True

    api.force_authenticate(bob)
    listing = api.get("/api/conversations/")
    item = listing.data["items"][0]
    assert item["last_message"]["body"] == "hey bob"
    assert item["last_message"]["is_mine"] is False


@pytest.mark.django_db
def test_empty_message_body_rejected(api, alice, bob):
    conversation = get_or_create_conversation(alice, bob)
    api.force_authenticate(alice)
    res = api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "   "}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_message_rate_limit(api, alice, bob):
    conversation = get_or_create_conversation(alice, bob)
    api.force_authenticate(alice)
    for _ in range(MESSAGES_PER_HOUR):
        res = api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hi"}, format="json")
        assert res.status_code == 201
    over_limit = api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hi"}, format="json")
    assert over_limit.status_code == 429


@pytest.mark.django_db
def test_new_conversation_rate_limit(api, alice):
    api.force_authenticate(alice)
    for i in range(CONVERSATIONS_PER_DAY):
        target = User.objects.create_user(username=f"user{i}", email=f"user{i}@example.com", password="x")
        res = api.post("/api/conversations/", {"user_id": target.id}, format="json")
        assert res.status_code == 201
    extra = User.objects.create_user(username="oneTooMany", email="onetoomany@example.com", password="x")
    over_limit = api.post("/api/conversations/", {"user_id": extra.id}, format="json")
    assert over_limit.status_code == 429


@pytest.mark.django_db
def test_sending_a_message_does_not_notify_the_recipient(api, alice, bob):
    conversation = get_or_create_conversation(alice, bob)
    api.force_authenticate(alice)

    api.post(f"/api/conversations/{conversation.id}/messages/", {"body": "hi"}, format="json")
    assert not Notification.objects.filter(user=bob).exists()


@pytest.fixture
def org(db, alice):
    organization = Organization.objects.create(name="Acme", slug="acme")
    OrgMembership.objects.create(org=organization, user=alice, role=OrgMembership.Role.OWNER)
    return organization


@pytest.mark.django_db
def test_org_conversation_list_and_reply(api, alice, bob, org):
    conversation = get_or_create_org_conversation(org, bob)
    OrgMessage.objects.create(org_conversation=conversation, sender=bob, body="Hello Acme")

    api.force_authenticate(alice)
    listing = api.get(f"/api/orgs/{org.slug}/conversations/")
    assert listing.status_code == 200
    assert len(listing.data["items"]) == 1
    assert listing.data["items"][0]["unread_count"] == 1

    res = api.post(
        f"/api/orgs/{org.slug}/conversations/{conversation.id}/messages/",
        {"body": "Thanks for reaching out"},
        format="json",
    )
    assert res.status_code == 201

    opened = api.get(f"/api/orgs/{org.slug}/conversations/{conversation.id}/messages/")
    assert opened.status_code == 200

    listing_after = api.get(f"/api/orgs/{org.slug}/conversations/")
    assert listing_after.data["items"][0]["unread_count"] == 0


@pytest.mark.django_db
def test_external_user_can_start_org_conversation(api, alice, bob, org):
    api.force_authenticate(bob)
    res = api.post(f"/api/orgs/{org.slug}/conversations/", {}, format="json")
    assert res.status_code == 201

    api.force_authenticate(alice)
    listing = api.get(f"/api/orgs/{org.slug}/conversations/")
    assert listing.status_code == 200
    assert len(listing.data["items"]) == 1
    assert listing.data["items"][0]["other_participant"]["id"] == bob.id
