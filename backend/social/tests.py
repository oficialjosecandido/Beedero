from django.core.cache import cache
from django.utils.timezone import now
import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from notifications.models import Notification
from orgs.constants import SectionKind
from orgs.models import Activity, OrgMembership, Organization, Visibility
from orgs.services import create_activity

from . import unfurl as unfurl_module
from .mentions import MAX_MENTIONS_PER_BODY, parse_mention_markers
from .models import LinkPreview, Mention, Reaction
from .services import create_comment
from .views import COMMENTS_PER_DAY, REACTIONS_PER_DAY


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def outsider(db):
    return User.objects.create_user(username="outsider", password="x")


@pytest.fixture
def activity(org):
    return Activity.objects.create(org=org, kind=SectionKind.NEWS, title="We launched!", occurred_at=now())


@pytest.fixture
def restricted_activity(org):
    return Activity.objects.create(
        org=org,
        kind=SectionKind.NEWS,
        title="members only",
        occurred_at=now(),
        visibility=Visibility.PRIVATE,
    )


@pytest.mark.django_db
def test_reaction_toggle_is_idempotent_and_updates_kind(api, outsider, activity):
    api.force_authenticate(outsider)

    first = api.post(f"/api/activities/{activity.id}/reactions/", {"kind": "like"}, format="json")
    assert first.status_code == 200
    assert first.data["reaction_count"] == 1

    second = api.post(f"/api/activities/{activity.id}/reactions/", {"kind": "like"}, format="json")
    assert second.status_code == 200
    assert second.data["reaction_count"] == 1  # no duplicate row, no double count

    changed = api.post(f"/api/activities/{activity.id}/reactions/", {"kind": "insight"}, format="json")
    assert changed.status_code == 200
    assert changed.data["reaction_count"] == 1  # kind updates in place
    assert Reaction.objects.get(activity=activity, user=outsider).kind == "insight"

    deleted = api.delete(f"/api/activities/{activity.id}/reactions/")
    assert deleted.status_code == 200
    assert deleted.data["reaction_count"] == 0

    # Idempotent delete: removing again doesn't go negative.
    deleted_again = api.delete(f"/api/activities/{activity.id}/reactions/")
    assert deleted_again.status_code == 200
    assert deleted_again.data["reaction_count"] == 0


@pytest.mark.django_db
def test_reaction_rate_limited(api, outsider, activity):
    api.force_authenticate(outsider)
    for _ in range(REACTIONS_PER_DAY):
        res = api.post(f"/api/activities/{activity.id}/reactions/", {"kind": "like"}, format="json")
        assert res.status_code == 200
    over_limit = api.post(f"/api/activities/{activity.id}/reactions/", {"kind": "like"}, format="json")
    assert over_limit.status_code == 429


@pytest.mark.django_db
def test_one_comment_per_user(api, outsider, activity):
    api.force_authenticate(outsider)

    first = api.post(f"/api/activities/{activity.id}/comments/", {"body": "nice!"}, format="json")
    assert first.status_code == 201

    duplicate = api.post(f"/api/activities/{activity.id}/comments/", {"body": "again"}, format="json")
    assert duplicate.status_code == 400
    assert "already commented" in str(duplicate.data).lower()

    listing = api.get(f"/api/activities/{activity.id}/comments/")
    assert listing.status_code == 200
    assert listing.data["viewer_has_commented"] is True
    assert len(listing.data["items"]) == 1


@pytest.mark.django_db
def test_comment_includes_author_profile_fields(api, outsider, activity):
    from accounts.models import InvestorProfile

    InvestorProfile.objects.create(
        user=outsider,
        full_name="Júlio Pomar",
        headline="Investor",
        country="PT",
        handle="juliopomar",
    )
    api.force_authenticate(outsider)
    api.post(f"/api/activities/{activity.id}/comments/", {"body": "Very well James."}, format="json")

    listing = api.get(f"/api/activities/{activity.id}/comments/")
    assert listing.status_code == 200
    item = listing.data["items"][0]
    assert item["author_name"] == "Júlio Pomar"
    assert item["author_id"] == outsider.id
    assert item["author_handle"] == "juliopomar"


@pytest.mark.django_db
def test_comment_cannot_be_deleted(api, outsider, activity):
    api.force_authenticate(outsider)
    created = api.post(f"/api/activities/{activity.id}/comments/", {"body": "hello"}, format="json")
    comment_id = created.data["id"]

    deleted = api.delete(f"/api/comments/{comment_id}/")
    assert deleted.status_code == 403

    activity.refresh_from_db()
    assert activity.comment_count == 1


@pytest.mark.django_db
def test_comment_rate_limited(api, outsider, org):
    api.force_authenticate(outsider)
    for i in range(COMMENTS_PER_DAY):
        act = Activity.objects.create(
            org=org, kind=SectionKind.NEWS, title=f"post {i}", occurred_at=now()
        )
        res = api.post(f"/api/activities/{act.id}/comments/", {"body": "hi"}, format="json")
        assert res.status_code == 201
    extra = Activity.objects.create(org=org, kind=SectionKind.NEWS, title="one more", occurred_at=now())
    over_limit = api.post(f"/api/activities/{extra.id}/comments/", {"body": "hi"}, format="json")
    assert over_limit.status_code == 429


@pytest.mark.django_db
def test_event_participation_accept_and_list(api, outsider, org):
    event = Activity.objects.create(
        org=org,
        kind=Activity.Kind.EVENTS,
        title="Demo day",
        occurred_at=now(),
        ends_at=now(),
    )
    api.force_authenticate(outsider)

    accept = api.post(f"/api/activities/{event.id}/participation/")
    assert accept.status_code == 200
    assert accept.data["status"] == "going"

    listed = api.get("/api/me/events/attending/")
    assert listed.status_code == 200
    assert len(listed.data) == 1
    assert listed.data[0]["title"] == "Demo day"
    assert listed.data[0]["host"]["type"] == "org"
    assert listed.data[0]["host"]["slug"] == org.slug

    cancel = api.delete(f"/api/activities/{event.id}/participation/")
    assert cancel.status_code == 204
    assert api.get("/api/me/events/attending/").data == []


@pytest.mark.django_db
def test_event_participation_rejects_non_events(api, outsider, activity):
    api.force_authenticate(outsider)
    res = api.post(f"/api/activities/{activity.id}/participation/")
    assert res.status_code == 400


@pytest.mark.django_db
def test_attending_events_can_exclude_org(api, outsider, org, db):
    other = Organization.objects.create(slug="other", name="Other", status=Organization.Status.LIVE)
    own_event = Activity.objects.create(
        org=org,
        kind=Activity.Kind.EVENTS,
        title="Our event",
        occurred_at=now(),
        ends_at=now(),
    )
    other_event = Activity.objects.create(
        org=other,
        kind=Activity.Kind.EVENTS,
        title="Their event",
        occurred_at=now(),
        ends_at=now(),
    )
    api.force_authenticate(outsider)
    api.post(f"/api/activities/{own_event.id}/participation/")
    api.post(f"/api/activities/{other_event.id}/participation/")

    filtered = api.get(f"/api/me/events/attending/?exclude_org={org.slug}")
    assert filtered.status_code == 200
    assert len(filtered.data) == 1
    assert filtered.data[0]["title"] == "Their event"


@pytest.mark.django_db
def test_restricted_activity_is_404_not_403_to_non_members(api, outsider, founder, restricted_activity):
    api.force_authenticate(outsider)

    comments = api.get(f"/api/activities/{restricted_activity.id}/comments/")
    assert comments.status_code == 404

    reaction = api.post(
        f"/api/activities/{restricted_activity.id}/reactions/", {"kind": "like"}, format="json"
    )
    assert reaction.status_code == 404

    # A member sees it fine.
    api.force_authenticate(founder)
    member_comments = api.get(f"/api/activities/{restricted_activity.id}/comments/")
    assert member_comments.status_code == 200
    member_reaction = api.post(
        f"/api/activities/{restricted_activity.id}/reactions/", {"kind": "like"}, format="json"
    )
    assert member_reaction.status_code == 200


# --- @-mentions ---


@pytest.fixture
def investor_with_handle(db):
    user = User.objects.create_user(username="investor1", email="investor1@example.com", password="x")
    InvestorProfile.objects.create(
        user=user, full_name="Ana Investor", headline="VC", country="PT", handle="ana"
    )
    return user


@pytest.mark.django_db
def test_comment_mention_resolves_and_notifies_target_user(api, outsider, activity, investor_with_handle):
    api.force_authenticate(outsider)
    res = api.post(
        f"/api/activities/{activity.id}/comments/",
        {"body": "Great work @[user:ana]!"},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["mentions"] == [
        {"marker": "@[user:ana]", "type": "user", "handle": "ana", "name": "Ana Investor"}
    ]
    assert Notification.objects.filter(
        user=investor_with_handle, kind=Notification.Kind.MENTION
    ).exists()


@pytest.mark.django_db
def test_self_mention_does_not_notify(api, investor_with_handle, activity):
    api.force_authenticate(investor_with_handle)
    res = api.post(
        f"/api/activities/{activity.id}/comments/",
        {"body": "I am @[user:ana]"},
        format="json",
    )
    assert res.status_code == 201
    assert not Notification.objects.filter(
        user=investor_with_handle, kind=Notification.Kind.MENTION
    ).exists()


@pytest.mark.django_db
def test_mention_notification_skipped_when_recipient_cant_see_activity(
    founder, restricted_activity, investor_with_handle
):
    """Mentioning someone never grants access — a mention notification only
    fires if the recipient could already see the underlying post."""
    create_comment(restricted_activity, founder, "hey @[user:ana]")

    assert not Notification.objects.filter(
        user=investor_with_handle, kind=Notification.Kind.MENTION
    ).exists()


@pytest.mark.django_db
def test_activity_mention_of_org_notifies_admins_but_not_actor(founder, org):
    beta = Organization.objects.create(slug="beta", name="Beta Inc", status=Organization.Status.LIVE)
    admin = User.objects.create_user(username="beta-admin", password="x")
    OrgMembership.objects.create(org=beta, user=admin, role=OrgMembership.Role.ADMIN)
    OrgMembership.objects.create(org=beta, user=founder, role=OrgMembership.Role.ADMIN)

    create_activity(
        author=founder,
        kind="update",
        title="Shoutout",
        body="Big fan of @[org:beta]",
        occurred_at=now(),
        visibility=Visibility.PUBLIC,
    )

    assert Notification.objects.filter(user=admin, kind=Notification.Kind.MENTION).exists()
    assert not Notification.objects.filter(user=founder, kind=Notification.Kind.MENTION).exists()


@pytest.mark.django_db
def test_mentions_are_capped_per_body():
    handles = [f"cap{i}" for i in range(MAX_MENTIONS_PER_BODY + 2)]
    body = " ".join(f"@[user:{h}]" for h in handles)

    markers = parse_mention_markers(body)

    assert len(markers) == MAX_MENTIONS_PER_BODY


@pytest.mark.django_db
def test_mention_search_returns_matching_users_and_orgs(api, outsider, investor_with_handle, org):
    api.force_authenticate(outsider)

    people = api.get("/api/mentions/search/?q=ana")
    assert people.status_code == 200
    assert any(u["handle"] == "ana" for u in people.data["users"])

    orgs = api.get(f"/api/mentions/search/?q={org.name[:3]}")
    assert any(o["slug"] == org.slug for o in orgs.data["orgs"])


@pytest.mark.django_db
def test_unresolved_marker_is_dropped_not_linked(api, outsider, activity):
    api.force_authenticate(outsider)
    res = api.post(
        f"/api/activities/{activity.id}/comments/",
        {"body": "cc @[user:nobody-with-this-handle]"},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["mentions"] == []
    assert not Mention.objects.exists()


# --- link previews ---


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("http error")

    def json(self):
        return self._json_data


@pytest.mark.django_db
def test_link_preview_fetches_and_caches(api, outsider, monkeypatch):
    calls = []

    def fake_get(url, params=None, timeout=None):
        calls.append(params["url"])
        return _FakeResponse(
            {
                "status": "success",
                "data": {
                    "title": "Example",
                    "description": "desc",
                    "image": {"url": "https://img.example.com/x.png"},
                    "publisher": "Example.com",
                },
            }
        )

    monkeypatch.setattr(unfurl_module.requests, "get", fake_get)
    api.force_authenticate(outsider)

    first = api.get("/api/links/preview/?url=https://example.com/article")
    assert first.status_code == 200
    assert first.data == {
        "status": "ready",
        "url": "https://example.com/article",
        "title": "Example",
        "description": "desc",
        "image_url": "https://img.example.com/x.png",
        "site_name": "Example.com",
    }

    second = api.get("/api/links/preview/?url=https://example.com/article")
    assert second.status_code == 200
    assert calls == ["https://example.com/article"]  # second call served from cache, no re-fetch
    assert LinkPreview.objects.count() == 1


@pytest.mark.django_db
def test_link_preview_degrades_gracefully_on_fetch_failure(api, outsider, monkeypatch):
    def fake_get(url, params=None, timeout=None):
        raise RuntimeError("unreachable")

    monkeypatch.setattr(unfurl_module.requests, "get", fake_get)
    api.force_authenticate(outsider)

    res = api.get("/api/links/preview/?url=https://down.example.com")

    assert res.status_code == 200
    assert res.data == {"status": "unavailable"}
    assert LinkPreview.objects.get().status == LinkPreview.Status.FAILED


@pytest.mark.django_db
def test_link_preview_rejects_non_http_scheme(api, outsider):
    api.force_authenticate(outsider)
    res = api.get("/api/links/preview/?url=javascript:alert(1)")
    assert res.status_code == 200
    assert res.data == {"status": "unavailable"}
    assert not LinkPreview.objects.exists()
