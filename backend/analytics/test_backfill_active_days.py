from datetime import date, datetime
from io import StringIO
from zoneinfo import ZoneInfo

import pytest
from django.core.management import call_command
from django.db import connection

from accounts.models import User
from analytics.models import UserActiveDay
from connections.models import ConnectionRequest
from conftest import BEEDERO_APP_DB_PASSWORD
from messaging.models import Conversation, Message
from notifications.models import Notification
from orgs.models import Activity

LISBON = ZoneInfo("Europe/Lisbon")
UTC = ZoneInfo("UTC")


def _at(y, m, d, hh=12, mm=0, tz=LISBON):
    return datetime(y, m, d, hh, mm, tzinfo=tz)


def _history():
    """alice and bob, with a few weeks of actions spread across sources —
    including two behind RLS (a message, a connection request)."""
    alice = User.objects.create_user(
        username="alice", email="alice@example.com", password="x", date_joined=_at(2026, 9, 1)
    )
    bob = User.objects.create_user(
        username="bob", email="bob@example.com", password="x", date_joined=_at(2026, 9, 2)
    )

    post = Activity.objects.create(
        author=alice, org=None, kind="update", title="Hello", body="", occurred_at=_at(2026, 9, 3)
    )
    Activity.objects.filter(pk=post.pk).update(created_at=_at(2026, 9, 3))

    first, second = sorted([alice, bob], key=lambda u: u.id)
    convo = Conversation.objects.create(participant_one=first, participant_two=second)
    msg = Message.objects.create(conversation=convo, sender=alice, body="hi")
    # 23:30 UTC on the 8th is 00:30 on the 9th in Lisbon.
    Message.objects.filter(pk=msg.pk).update(created_at=_at(2026, 9, 8, 23, 30, tz=UTC))

    req = ConnectionRequest.objects.create(requester=bob, recipient=alice, note="hey")
    ConnectionRequest.objects.filter(pk=req.pk).update(
        created_at=_at(2026, 9, 10), responded_at=_at(2026, 9, 12)
    )

    Notification.objects.create(
        user=alice, kind="milestone", aggregate_key="k", title="t", body="b",
        read_at=_at(2026, 9, 15),
    )
    return alice, bob


def _days(user):
    return sorted(UserActiveDay.objects.filter(user=user).values_list("day", flat=True))


@pytest.mark.django_db
def test_backfill_reconstructs_days_from_actor_rows_only():
    alice, bob = _history()

    call_command("backfill_active_days", stdout=StringIO())

    assert _days(alice) == [
        date(2026, 9, 1),   # joined
        date(2026, 9, 3),   # posted
        date(2026, 9, 9),   # sent a message (Lisbon day, not UTC)
        date(2026, 9, 12),  # answered a connection request
        date(2026, 9, 15),  # read a notification
    ]
    # Receiving a message is not activity; sending a request is.
    assert _days(bob) == [date(2026, 9, 2), date(2026, 9, 10)]
    assert not UserActiveDay.objects.filter(inferred=False).exists()


@pytest.mark.django_db
def test_backfill_is_idempotent_and_never_downgrades_observed_days():
    alice, _ = _history()
    UserActiveDay.objects.create(user=alice, day=date(2026, 9, 3), inferred=False)

    call_command("backfill_active_days", stdout=StringIO())
    total = UserActiveDay.objects.count()
    out = StringIO()
    call_command("backfill_active_days", stdout=out)

    assert UserActiveDay.objects.count() == total
    assert "wrote 0 new row(s)" in out.getvalue()
    assert UserActiveDay.objects.get(user=alice, day=date(2026, 9, 3)).inferred is False


@pytest.mark.django_db
def test_dry_run_writes_nothing():
    _history()
    out = StringIO()
    call_command("backfill_active_days", "--dry-run", stdout=out)
    assert UserActiveDay.objects.count() == 0
    assert "would write" in out.getvalue()


@pytest.mark.django_db(transaction=True)
def test_backfill_sees_rls_protected_rows_as_the_unprivileged_app_role(_grant_app_role_on_test_db):
    """Tests normally connect as a superuser, which ignores RLS. Production
    doesn't. Re-run the command as `beedero_app` to prove messages and
    connection requests are still found — and that they'd be invisible
    without the per-person viewer the command sets."""
    alice, _ = _history()

    original = dict(connection.settings_dict)
    connection.close()
    connection.settings_dict["USER"] = "beedero_app"
    connection.settings_dict["PASSWORD"] = BEEDERO_APP_DB_PASSWORD
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_user")
            assert cursor.fetchone()[0] == "beedero_app"
        # Control: with no viewer set, RLS hides these rows entirely.
        assert Message.objects.count() == 0
        assert ConnectionRequest.objects.count() == 0

        call_command("backfill_active_days", stdout=StringIO())
    finally:
        connection.close()
        connection.settings_dict.clear()
        connection.settings_dict.update(original)

    assert date(2026, 9, 9) in _days(alice)   # message
    assert date(2026, 9, 12) in _days(alice)  # connection request answered
