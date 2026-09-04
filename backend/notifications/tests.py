from datetime import date, timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import Activity, FundraiseRound, OrgFollow, OrgMembership, Organization

from .milestones import (
    check_credibility_level_milestone,
    check_first_post_milestone,
    check_follower_milestone,
    check_org_anniversary_milestone,
    check_round_closed_milestone,
)
from .models import DigestSend, Notification, NotificationPreference
from .services import notify, notify_milestone
from .views import digest_pixel_token, digest_unsubscribe_token


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", email="owner@example.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


# --- notify(): 6h aggregation window + engagement-preference gating ---


@pytest.mark.django_db
def test_notify_aggregates_within_window(owner):
    first = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t1", body="b1")
    second = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t2", body="b2")

    assert first.id == second.id
    assert Notification.objects.filter(user=owner, aggregate_key="k1").count() == 1
    second.refresh_from_db()
    assert second.title == "t2"


@pytest.mark.django_db
def test_notify_creates_new_row_outside_window(owner):
    first = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t1", body="b1")
    Notification.objects.filter(pk=first.pk).update(updated_at=timezone.now() - timedelta(hours=7))

    second = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t2", body="b2")

    assert second.id != first.id
    assert Notification.objects.filter(user=owner, aggregate_key="k1").count() == 2


@pytest.mark.django_db
def test_notify_creates_new_row_if_previous_was_read(owner):
    first = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t1", body="b1")
    first.read_at = timezone.now()
    first.save(update_fields=["read_at"])

    second = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t2", body="b2")

    assert second.id != first.id


@pytest.mark.django_db
def test_notify_respects_engagement_preference_off(owner):
    NotificationPreference.objects.create(user=owner, inapp_engagement=False)

    result = notify(owner, kind=Notification.Kind.REACTION, aggregate_key="k1", title="t", body="b")

    assert result is None
    assert not Notification.objects.filter(user=owner).exists()


@pytest.mark.django_db
def test_notify_verification_kind_ignores_engagement_preference(owner):
    NotificationPreference.objects.create(user=owner, inapp_engagement=False)

    result = notify(owner, kind=Notification.Kind.VERIFICATION, aggregate_key="k1", title="t", body="b")

    assert result is not None


# --- notify_milestone(): fire-once-forever idempotency ---


@pytest.mark.django_db
def test_notify_milestone_fires_once_ever(owner):
    first = notify_milestone(owner, aggregate_key="m1", title="t", body="b")
    second = notify_milestone(owner, aggregate_key="m1", title="t2", body="b2")

    assert first is not None
    assert second is None
    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key="m1"
    ).count() == 1


@pytest.mark.django_db
def test_notify_milestone_ignores_engagement_preference(owner):
    NotificationPreference.objects.create(user=owner, inapp_engagement=False)

    result = notify_milestone(owner, aggregate_key="m1", title="t", body="b")

    assert result is not None


@pytest.mark.django_db
def test_notify_milestone_stores_suggestion_payload(owner):
    n = notify_milestone(
        owner, aggregate_key="m1", title="t", body="b", suggestion_title="ST", suggestion_body="SB"
    )

    assert n.payload == {"suggestion_title": "ST", "suggestion_body": "SB"}


# --- milestone triggers ---


@pytest.mark.django_db
def test_follower_milestone_fires_only_at_exact_threshold(org, owner):
    users = [User.objects.create_user(username=f"follower{i}", password="x") for i in range(50)]
    OrgFollow.objects.bulk_create([OrgFollow(org=org, user=u) for u in users[:49]])

    check_follower_milestone(org)
    assert not Notification.objects.filter(kind=Notification.Kind.MILESTONE).exists()

    OrgFollow.objects.create(org=org, user=users[49])
    check_follower_milestone(org)

    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:followers:{org.id}:50"
    ).exists()

    check_follower_milestone(org)  # repeat call at same count doesn't duplicate
    assert Notification.objects.filter(kind=Notification.Kind.MILESTONE).count() == 1


@pytest.mark.django_db
def test_credibility_level_milestone_fires_on_increase_only(org, owner):
    check_credibility_level_milestone(org, previous_level=0, new_level=0)
    assert not Notification.objects.filter(kind=Notification.Kind.MILESTONE).exists()

    check_credibility_level_milestone(org, previous_level=0, new_level=1)
    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:credibility:{org.id}:1"
    ).exists()

    check_credibility_level_milestone(org, previous_level=2, new_level=1)  # a drop never fires
    assert Notification.objects.filter(kind=Notification.Kind.MILESTONE).count() == 1


@pytest.mark.django_db
def test_round_closed_milestone(org, owner):
    round_ = FundraiseRound.objects.create(
        org=org, stage=FundraiseRound.Stage.SEED, raised_amount=100000, is_open=False
    )

    check_round_closed_milestone(org, round_)

    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:round_closed:{round_.id}"
    ).exists()


@pytest.mark.django_db
def test_first_post_milestone_fires_only_on_first(org, owner):
    Activity.objects.create(org=org, kind=Activity.Kind.NEWS, title="p1", occurred_at=timezone.now())
    check_first_post_milestone(org)

    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:first_post:{org.id}"
    ).exists()

    Activity.objects.create(org=org, kind=Activity.Kind.NEWS, title="p2", occurred_at=timezone.now())
    check_first_post_milestone(org)
    assert Notification.objects.filter(kind=Notification.Kind.MILESTONE).count() == 1


@pytest.mark.django_db
def test_anniversary_milestone_fires_only_on_exact_date_after_a_year(owner):
    org = Organization.objects.create(slug="anniv", name="Anniv Co", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    Organization.objects.filter(pk=org.pk).update(
        created_at=timezone.make_aware(timezone.datetime(2024, 7, 10))
    )
    org.refresh_from_db()

    check_org_anniversary_milestone(org, date(2025, 7, 9))
    assert not Notification.objects.filter(kind=Notification.Kind.MILESTONE).exists()

    check_org_anniversary_milestone(org, date(2025, 7, 10))
    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:anniversary:{org.id}:1"
    ).exists()

    check_org_anniversary_milestone(org, date(2025, 7, 10))  # same day again doesn't duplicate
    assert Notification.objects.filter(kind=Notification.Kind.MILESTONE).count() == 1


@pytest.mark.django_db
def test_check_milestones_command_checks_anniversaries_for_today(owner):
    org = Organization.objects.create(slug="cmd-anniv", name="Cmd Co", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    today = timezone.localdate()
    Organization.objects.filter(pk=org.pk).update(
        created_at=timezone.make_aware(timezone.datetime(today.year - 1, today.month, today.day))
    )

    call_command("check_milestones")

    assert Notification.objects.filter(
        user=owner, kind=Notification.Kind.MILESTONE, aggregate_key=f"milestone:anniversary:{org.id}:1"
    ).exists()


# --- preferences + digest views ---


@pytest.mark.django_db
def test_preferences_get_defaults_and_patch(api, owner):
    api.force_authenticate(owner)

    res = api.get("/api/notifications/preferences/")
    assert res.status_code == 200
    assert res.data == {"digest_email": True, "inapp_engagement": True, "push_enabled": True}

    res = api.patch("/api/notifications/preferences/", {"inapp_engagement": False}, format="json")
    assert res.status_code == 200
    assert res.data == {"digest_email": True, "inapp_engagement": False, "push_enabled": True}
    assert NotificationPreference.objects.get(user=owner).inapp_engagement is False


@pytest.mark.django_db
def test_notification_list_includes_milestone_payload(api, owner):
    notify_milestone(owner, aggregate_key="m1", title="t", body="b", suggestion_title="ST", suggestion_body="SB")
    api.force_authenticate(owner)

    res = api.get("/api/notifications/")

    assert res.status_code == 200
    assert res.data["items"][0]["payload"] == {"suggestion_title": "ST", "suggestion_body": "SB"}


@pytest.mark.django_db
def test_digest_unsubscribe_with_valid_token(api, owner):
    pref = NotificationPreference.objects.create(user=owner, digest_email=True)
    token = digest_unsubscribe_token(owner.id)

    res = api.get(f"/api/notifications/digest/unsubscribe/?token={token}")

    assert res.status_code == 200
    pref.refresh_from_db()
    assert pref.digest_email is False


@pytest.mark.django_db
def test_digest_unsubscribe_with_invalid_token(api):
    res = api.get("/api/notifications/digest/unsubscribe/?token=garbage")
    assert res.status_code == 400


@pytest.mark.django_db
def test_digest_pixel_marks_opened(api, owner):
    send = DigestSend.objects.create(user=owner)
    token = digest_pixel_token(send.id)

    res = api.get(f"/api/notifications/digest/pixel.gif?token={token}")

    assert res.status_code == 200
    assert res["Content-Type"] == "image/gif"
    send.refresh_from_db()
    assert send.opened_at is not None


@pytest.mark.django_db
def test_digest_pixel_with_invalid_token_still_returns_gif(api):
    res = api.get("/api/notifications/digest/pixel.gif?token=garbage")
    assert res.status_code == 200
    assert res["Content-Type"] == "image/gif"


# --- weekly digest command: the non-negotiable zero-signal rule ---


@pytest.mark.django_db
def test_send_weekly_digest_skips_zero_signal_week(settings, owner, org):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

    call_command("send_weekly_digest")

    assert len(mail.outbox) == 0
    assert DigestSend.objects.count() == 0


@pytest.mark.django_db
def test_send_weekly_digest_sends_when_there_is_signal(settings, owner, org):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    OrgFollow.objects.create(org=org, user=User.objects.create_user(username="follower1", password="x"))

    call_command("send_weekly_digest")

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [owner.email]
    assert DigestSend.objects.filter(user=owner).count() == 1
    html_body = mail.outbox[0].alternatives[0][0]
    assert "unsubscribe" in html_body.lower()
    assert "pixel.gif" in html_body


@pytest.mark.django_db
def test_send_weekly_digest_respects_unsubscribe_preference(settings, owner, org):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    NotificationPreference.objects.create(user=owner, digest_email=False)
    OrgFollow.objects.create(org=org, user=User.objects.create_user(username="follower2", password="x"))

    call_command("send_weekly_digest")

    assert len(mail.outbox) == 0
