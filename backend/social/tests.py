from django.core.cache import cache
from django.utils.timezone import now
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import Activity, OrgMembership, Organization, Visibility

from .models import Comment, Reaction
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
def test_comment_thread_is_capped_at_one_level(api, outsider, activity):
    api.force_authenticate(outsider)

    top = api.post(f"/api/activities/{activity.id}/comments/", {"body": "nice!"}, format="json")
    assert top.status_code == 201

    reply = api.post(
        f"/api/activities/{activity.id}/comments/",
        {"body": "agreed", "parent_id": top.data["id"]},
        format="json",
    )
    assert reply.status_code == 201

    nested_reply = api.post(
        f"/api/activities/{activity.id}/comments/",
        {"body": "too deep", "parent_id": reply.data["id"]},
        format="json",
    )
    assert nested_reply.status_code == 400


@pytest.mark.django_db
def test_comment_rate_limited(api, outsider, activity):
    api.force_authenticate(outsider)
    for _ in range(COMMENTS_PER_DAY):
        res = api.post(f"/api/activities/{activity.id}/comments/", {"body": "hi"}, format="json")
        assert res.status_code == 201
    over_limit = api.post(f"/api/activities/{activity.id}/comments/", {"body": "hi"}, format="json")
    assert over_limit.status_code == 429


@pytest.mark.django_db
def test_comment_soft_delete(api, founder, outsider, activity):
    api.force_authenticate(outsider)
    created = api.post(f"/api/activities/{activity.id}/comments/", {"body": "hello"}, format="json")
    comment_id = created.data["id"]
    activity.refresh_from_db()
    assert activity.comment_count == 1

    # Neither the author nor an org owner/admin: forbidden.
    other = User.objects.create_user(username="other", password="x")
    api.force_authenticate(other)
    forbidden = api.delete(f"/api/comments/{comment_id}/")
    assert forbidden.status_code == 403

    # Org owner can delete someone else's comment.
    api.force_authenticate(founder)
    res = api.delete(f"/api/comments/{comment_id}/")
    assert res.status_code == 204

    activity.refresh_from_db()
    assert activity.comment_count == 0
    comment = Comment.objects.get(pk=comment_id)
    assert comment.deleted_at is not None  # soft delete, row still exists

    listing = api.get(f"/api/activities/{activity.id}/comments/")
    assert comment_id not in [item["id"] for item in listing.data["items"]]


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
