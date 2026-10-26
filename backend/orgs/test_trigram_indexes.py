"""The trigram indexes behind discovery's `q=` search, and — more to the
point — that the command creating them can never stop the container booting
(startup.sh runs it with `set -e`)."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.db import DatabaseError, connection

from orgs.management.commands.ensure_trigram_indexes import INDEXES, Command


def _existing_index_names() -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute("SELECT indexname FROM pg_indexes WHERE indexname LIKE %s", ["%_trgm"])
        return {row[0] for row in cursor.fetchall()}


@pytest.mark.django_db
def test_creates_every_index_and_is_idempotent():
    out = StringIO()
    call_command("ensure_trigram_indexes", stdout=out)
    assert "trigram index(es) in place" in out.getvalue()
    assert _existing_index_names() >= {name for name, _, _ in INDEXES}

    # Second run must be a no-op rather than an "already exists" error.
    again = StringIO()
    call_command("ensure_trigram_indexes", stdout=again)
    assert "trigram index(es) in place" in again.getvalue()


@pytest.mark.django_db
def test_the_planner_can_use_the_index_for_ilike():
    call_command("ensure_trigram_indexes", stdout=StringIO())
    with connection.cursor() as cursor:
        # The tables are small enough locally that a seq scan wins on cost;
        # this asks whether the index is *eligible*, which is what the
        # gin_trgm_ops opclass buys us.
        cursor.execute("SET LOCAL enable_seqscan = off")
        cursor.execute("EXPLAIN SELECT 1 FROM orgs_organization WHERE name ILIKE '%%acme%%'")
        plan = "\n".join(row[0] for row in cursor.fetchall())
    assert "orgs_organization_name_trgm" in plan


@pytest.mark.django_db
def test_missing_extension_is_reported_and_not_fatal(monkeypatch):
    monkeypatch.setattr(Command, "_ensure_extension", lambda self: False)
    out = StringIO()
    call_command("ensure_trigram_indexes", stdout=out)
    assert "trigram index(es) in place" not in out.getvalue()


@pytest.mark.django_db
def test_an_index_that_cannot_be_created_is_reported_and_not_fatal(monkeypatch):
    monkeypatch.setattr(Command, "_ensure_extension", lambda self: True)
    monkeypatch.setattr(
        Command, "_create_index", lambda self, name, table, column: "ProgrammingError: denied"
    )
    out = StringIO()
    call_command("ensure_trigram_indexes", stdout=out)
    assert f"Could not create {len(INDEXES)} of {len(INDEXES)}" in out.getvalue()


@pytest.mark.django_db
def test_create_index_returns_the_error_instead_of_raising():
    error = Command()._create_index("bad_trgm", "table_that_does_not_exist", "nope")
    assert error is not None
    # The connection must still be usable for whatever startup.sh runs next.
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        assert cursor.fetchone() == (1,)


@pytest.mark.django_db
def test_extension_check_survives_a_privilege_error(monkeypatch):
    def deny(sql, *args, **kwargs):
        if "CREATE EXTENSION" in sql:
            raise DatabaseError("permission denied to create extension")
        return None

    command = Command()
    command.stdout = StringIO()
    monkeypatch.setattr(
        "orgs.management.commands.ensure_trigram_indexes.connection", _DenyingConnection(deny)
    )
    assert command._ensure_extension() is False
    assert "pg_trgm is not available" in command.stdout.getvalue()


class _DenyingCursor:
    def __init__(self, execute):
        self._execute = execute

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, *args, **kwargs):
        return self._execute(sql, *args, **kwargs)

    def fetchone(self):
        return None


class _DenyingConnection:
    """Stands in for `connection` so the privilege error can be exercised
    without a second database role."""

    vendor = "postgresql"

    def __init__(self, execute):
        self._execute = execute

    def cursor(self):
        return _DenyingCursor(self._execute)
