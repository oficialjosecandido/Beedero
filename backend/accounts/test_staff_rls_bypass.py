"""The /admin/ "delete selected users" 500.

Django does not use the database's ON DELETE CASCADE: it emulates the cascade
in Python, issuing `DELETE FROM <child> WHERE <user_fk> IN (...)` as ordinary
statements. Ordinary statements obey RLS. A session-authenticated /admin/
request carries no Firebase JWT, so orgs.middleware._viewer_id() returns 0, no
row matches, and under FORCE ROW LEVEL SECURITY those child deletes remove
nothing -- silently, no error. The parent `DELETE FROM accounts_user` then
violates the foreign key at COMMIT (Django creates FKs DEFERRABLE INITIALLY
DEFERRED on Postgres), which surfaces as a bare 500 with no statement to blame.

The `staff_bypass` policies added in <app>/migrations/*_staff_rls_bypass.py fix
that, driven by the `beedero.is_staff` GUC the middleware now sets.

These tests run as the unprivileged `beedero_app` role, like the other RLS
tests: pytest's own connection is a superuser, and a superuser bypasses RLS
even with FORCE, so asserting through the ORM here would pass with or without
the migration -- a false green.
"""

from accounts.models import User
from connections.models import Connection
from messaging.models import Conversation, Message


def _pair(prefix):
    one = User.objects.create_user(username=f"{prefix}-one", email=f"{prefix}-one@example.com", password="x")
    two = User.objects.create_user(username=f"{prefix}-two", email=f"{prefix}-two@example.com", password="x")
    return sorted([one, two], key=lambda u: u.id)


def _as_admin_request(cursor, is_staff):
    """What the middleware leaves on the session for an /admin/ request."""
    cursor.execute("SELECT set_config('beedero.viewer_id', '0', false)")
    cursor.execute("SELECT set_config('beedero.is_staff', %s, false)", ["1" if is_staff else "0"])


def test_staff_bypass_reaches_a_policy_keyed_on_the_row_itself(db_app_role_connection):
    """connections_connection: the policy compares viewer_id to the row's own
    columns, so viewer 0 matches nothing."""
    first, second = _pair("rls-staff-conn")
    Connection.objects.create(user_one=first, user_two=second)

    with db_app_role_connection.cursor() as c:
        _as_admin_request(c, is_staff=False)
        c.execute("DELETE FROM connections_connection WHERE user_one_id = %s", [first.id])
        assert c.rowcount == 0, "without the staff flag the cascade silently deletes nothing"

        _as_admin_request(c, is_staff=True)
        c.execute("DELETE FROM connections_connection WHERE user_one_id = %s", [first.id])
        assert c.rowcount == 1


def test_staff_bypass_reaches_a_policy_keyed_on_a_parent_row(db_app_role_connection):
    """messaging_message: the policy is a subquery on the conversation, so the
    message is unreachable even though its own sender_id is the user being
    deleted. Both tables need the bypass, and in this order."""
    first, second = _pair("rls-staff-msg")
    conversation = Conversation.objects.create(participant_one=first, participant_two=second)
    Message.objects.create(conversation=conversation, sender=first, body="hello")

    with db_app_role_connection.cursor() as c:
        _as_admin_request(c, is_staff=False)
        c.execute("DELETE FROM messaging_message WHERE sender_id = %s", [first.id])
        assert c.rowcount == 0

        _as_admin_request(c, is_staff=True)
        c.execute("DELETE FROM messaging_message WHERE sender_id = %s", [first.id])
        assert c.rowcount == 1
        c.execute("DELETE FROM messaging_conversation WHERE id = %s", [conversation.id])
        assert c.rowcount == 1


def test_bypass_is_off_by_default(db_app_role_connection):
    """An unset GUC must read as "not staff", not as "staff". This is what
    keeps management commands, tests and the RLS-exempt public routes on the
    old behaviour: current_setting(..., true) is NULL there, and NULL = '1'
    is NULL, which RLS treats as false."""
    first, second = _pair("rls-staff-default")
    Connection.objects.create(user_one=first, user_two=second)

    with db_app_role_connection.cursor() as c:
        c.execute("SELECT set_config('beedero.viewer_id', '0', false)")
        c.execute("SELECT current_setting('beedero.is_staff', true)")
        assert c.fetchone()[0] in (None, "", "0")
        c.execute("SELECT count(*) FROM connections_connection WHERE user_one_id = %s", [first.id])
        assert c.fetchone()[0] == 0
