from django.core.cache import cache
from django.utils.timezone import now
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import Activity, OrgMembership, Organization, Visibility

from .models import Reaction
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
