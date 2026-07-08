import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import OrgField, OrgFollow, Organization


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def viewer(db, org):
    user = User.objects.create_user(username="viewer", password="x")
    OrgFollow.objects.create(org=org, user=user)
    return user


def _post(org, key, occurred_at_iso):
    section = org.sections.get(kind=SectionKind.NEWS)
    return OrgField.objects.create(
        section=section, key=key, value={"title": key, "occurred_at": occurred_at_iso}
    )


@pytest.mark.django_db
def test_feed_orders_newest_first(api, org, viewer):
    _post(org, "old", "2026-01-01T00:00:00Z")
    _post(org, "new", "2026-06-01T00:00:00Z")
    _post(org, "mid", "2026-03-01T00:00:00Z")

    api.force_authenticate(viewer)
    res = api.get("/api/feed/")
    assert res.status_code == 200
    keys = [item["key"] for item in res.data["items"]]
    assert keys == ["new", "mid", "old"]


@pytest.mark.django_db
def test_feed_pagination_covers_all_items_without_duplicates_or_gaps(api, org, viewer):
    for i in range(5):
        _post(org, f"post{i}", f"2026-01-0{i + 1}T00:00:00Z")

    api.force_authenticate(viewer)
    seen_keys = []
    cursor = None
    for _ in range(10):  # generous upper bound so a broken loop can't hang the suite
        url = "/api/feed/?limit=2"
        if cursor:
            url += f"&cursor={cursor}"
        res = api.get(url)
        assert res.status_code == 200
        seen_keys += [item["key"] for item in res.data["items"]]
        cursor = res.data["next_cursor"]
        if cursor is None:
            break

    assert seen_keys == ["post4", "post3", "post2", "post1", "post0"]


@pytest.mark.django_db
def test_feed_rejects_invalid_cursor(api, org, viewer):
    api.force_authenticate(viewer)
    res = api.get("/api/feed/?cursor=not-a-real-cursor")
    assert res.status_code == 400


@pytest.mark.django_db
def test_feed_clamps_limit(api, org, viewer):
    for i in range(3):
        _post(org, f"post{i}", f"2026-01-0{i + 1}T00:00:00Z")

    api.force_authenticate(viewer)
    res = api.get("/api/feed/?limit=999")
    assert res.status_code == 200
    assert len(res.data["items"]) == 3
