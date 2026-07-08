import psycopg
import pytest


@pytest.fixture(scope="session")
def _grant_app_role_on_test_db(django_db_setup, django_db_blocker):
    """Runs once per session, outside any per-test transaction: grants
    `beedero_app` the same runtime privileges it has in real environments on
    the freshly created test DB (default privileges set on the dev DB don't
    carry over to this ephemeral one). Must commit for real — a per-test
    transaction that only ever rolls back would be invisible to the separate
    raw connection `db_app_role_connection` opens."""
    from django.db import connection

    with django_db_blocker.unblock():
        settings_dict = connection.settings_dict
        conn = psycopg.connect(
            dbname=settings_dict["NAME"],
            host=settings_dict["HOST"] or "localhost",
            port=settings_dict["PORT"] or 5432,
            user=settings_dict["USER"],
            password=settings_dict["PASSWORD"] or None,
            autocommit=True,
        )
        try:
            with conn.cursor() as c:
                c.execute("GRANT USAGE ON SCHEMA public TO beedero_app")
                c.execute(
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beedero_app"
                )
                c.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beedero_app")
        finally:
            conn.close()


@pytest.fixture
def db_app_role_connection(transactional_db, _grant_app_role_on_test_db):
    """A raw connection to the *same* test database Django just migrated,
    authenticated as the non-privileged `beedero_app` role — not the
    superuser/CREATEDB role pytest-django uses to manage the test DB itself.

    Uses `transactional_db` (commits for real, truncates after) rather than
    the default `db` fixture (wraps the test in a transaction that only ever
    rolls back) — a separate connection in another session can't see
    uncommitted rows from this one.

    Proves RLS is enforced by the database, independent of the ORM/resolver:
    if the app ever regresses to connecting as a superuser (which bypasses
    RLS even with FORCE ROW LEVEL SECURITY), tests using this fixture fail."""
    from django.db import connection

    settings_dict = connection.settings_dict
    conn = psycopg.connect(
        dbname=settings_dict["NAME"],
        host=settings_dict["HOST"] or "localhost",
        port=settings_dict["PORT"] or 5432,
        user="beedero_app",
        password="",
        autocommit=True,
    )
    try:
        yield conn
    finally:
        conn.close()
