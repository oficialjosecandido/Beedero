"""Removing posts and resolving reports."""

import pytest
from django.core import mail
from django.utils import timezone

from accounts.testing import unlock
from messaging.models import MessageReport
from nexus.models import NexusAction
from notifications.models import Notification
from orgs.feed import activity_feed_items
from orgs.models import Activity, Organization, OrgMembership, Visibility


@pytest.fixture
def ana(make_user):
    user = make_user("ana", email="ana@lumen.pt")
    unlock(user, full_name="Ana Silva", handle="anasilva")
    return user


@pytest.fixture
def lumen(ana):
    org = Organization.objects.create(slug="lumen", name="Lumen Credit", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=ana, role=OrgMembership.Role.OWNER)
    return org


def post(org=None, author=None, title="Hello", visibility=Visibility.PUBLIC):
    return Activity.objects.create(
        org=org, author=author, kind="news", title=title, body="Body", occurred_at=timezone.now(), visibility=visibility
    )


# ------------------------------------------------------------------ posts


@pytest.mark.django_db
def test_staff_see_public_and_personal_posts_but_not_members_only(as_staff, lumen, ana):
    public = post(lumen, ana, "Public news")
    personal = post(None, ana, "My own post")
    post(lumen, ana, "Team only", visibility=Visibility.PRIVATE)
    titles = [row["title"] for row in as_staff.get("/api/nexus/posts/").json()["results"]]
    assert set(titles) == {public.title, personal.title}


@pytest.mark.django_db
def test_removing_a_post_hides_it_everywhere_and_tells_the_author(as_staff, staff, lumen, ana, make_user):
    target = post(lumen, ana, "Buy crypto now")
    response = as_staff.post(f"/api/nexus/posts/{target.id}/remove/", {"reason": "spam"}, format="json")
    assert response.status_code == 200
    assert response.json()["removed"]["reason_label"] == "Spam or repeated content"

    assert not Activity.objects.filter(pk=target.pk).exists()
    assert Activity.all_objects.get(pk=target.pk).removed_by == staff
    reader = make_user("reader")
    assert target.id not in [a.id for a in activity_feed_items(reader, [lumen.id], set())]
    as_staff.force_authenticate(reader)
    assert as_staff.post(f"/api/activities/{target.id}/reactions/", {"kind": "like"}).status_code == 404

    note = Notification.objects.get(user=ana, kind=Notification.Kind.MODERATION)
    assert "Buy crypto now" in note.body and "Spam" in note.body
    assert mail.outbox[-1].to == ["ana@lumen.pt"]
    assert NexusAction.objects.filter(action="post.removed", target_id=str(target.id)).exists()


@pytest.mark.django_db
def test_a_reason_is_required(as_staff, lumen, ana):
    target = post(lumen, ana)
    assert as_staff.post(f"/api/nexus/posts/{target.id}/remove/", {}).status_code == 400
    assert Activity.objects.filter(pk=target.pk).exists()


@pytest.mark.django_db
def test_removed_posts_have_their_own_list(as_staff, lumen, ana):
    target = post(lumen, ana, "Gone")
    as_staff.post(f"/api/nexus/posts/{target.id}/remove/", {"reason": "misleading"}, format="json")
    assert as_staff.get("/api/nexus/posts/").json()["results"] == []
    removed = as_staff.get("/api/nexus/posts/", {"state": "removed"}).json()["results"]
    assert [row["title"] for row in removed] == ["Gone"]


@pytest.mark.django_db
def test_only_admins_restore(as_staff, api, admin, lumen, ana):
    target = post(lumen, ana)
    as_staff.post(f"/api/nexus/posts/{target.id}/remove/", {"reason": "spam"}, format="json")
    assert as_staff.post(f"/api/nexus/posts/{target.id}/restore/", {}).status_code == 403
    api.force_authenticate(admin)
    assert api.post(f"/api/nexus/posts/{target.id}/restore/", {"note": "Not spam"}, format="json").status_code == 200
    assert Activity.objects.filter(pk=target.pk).exists()


# ---------------------------------------------------------------- reports


@pytest.fixture
def report(ana, make_user):
    bob = make_user("bob")
    return MessageReport.objects.create(reporter=ana, reported_user=bob, reason="harassment", details="Kept messaging me")


@pytest.mark.django_db
def test_open_reports_come_oldest_first(as_staff, report):
    rows = as_staff.get("/api/nexus/reports/").json()["results"]
    assert [row["id"] for row in rows] == [report.id]
    assert rows[0]["reported"]["reports_total"] == 1
    assert rows[0]["details"] == "Kept messaging me"


@pytest.mark.django_db
def test_a_warning_tells_the_person_and_closes_the_report(as_staff, report):
    response = as_staff.post(f"/api/nexus/reports/{report.id}/resolve/", {"resolution": "warned"}, format="json")
    assert response.status_code == 200
    assert Notification.objects.filter(user=report.reported_user, kind=Notification.Kind.MODERATION).exists()
    report.refresh_from_db()
    assert report.resolution == "warned" and report.resolved_at
    assert as_staff.get("/api/nexus/reports/").json()["results"] == []
    assert as_staff.post(f"/api/nexus/reports/{report.id}/resolve/", {"resolution": "no_action"}).status_code == 400


@pytest.mark.django_db
def test_suspending_from_a_report_is_for_admins(as_staff, api, admin, report):
    assert as_staff.post(f"/api/nexus/reports/{report.id}/resolve/", {"resolution": "suspended"}).status_code == 403
    api.force_authenticate(admin)
    api.post(f"/api/nexus/reports/{report.id}/resolve/", {"resolution": "suspended", "note": "Third report"}, format="json")
    report.reported_user.refresh_from_db()
    assert report.reported_user.is_active is False
