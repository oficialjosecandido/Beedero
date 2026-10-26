from django.core.management.base import BaseCommand
from django.db import DatabaseError, connection, transaction

# The `q=` searches in orgs/discovery.py (`discover` and `discover_people`)
# compile to `ILIKE '%term%'`, which no btree index can serve — Postgres reads
# every row of both tables. A GIN index over trigrams serves them.
INDEXES = (
    ("orgs_organization_name_trgm", "orgs_organization", "name"),
    ("orgs_organization_one_liner_trgm", "orgs_organization", "one_liner"),
    ("orgs_organization_slug_trgm", "orgs_organization", "slug"),
    ("accounts_investorprofile_full_name_trgm", "accounts_investorprofile", "full_name"),
    ("accounts_investorprofile_headline_trgm", "accounts_investorprofile", "headline"),
    ("accounts_investorprofile_handle_trgm", "accounts_investorprofile", "handle"),
)


class Command(BaseCommand):
    """Creates the pg_trgm indexes behind discovery's free-text search.

    This is not a migration because it cannot be guaranteed to succeed:
    `CREATE EXTENSION pg_trgm` needs an admin role, and on Azure Database for
    PostgreSQL the extension must also be listed in the `azure.extensions`
    server parameter. A migration that failed there would stop the container
    from booting (startup.sh runs `migrate` with `set -e`), and one that
    skipped would still be recorded as applied — so the indexes would never
    appear once the extension did.

    Instead this runs on every boot, like `createcachetable`. Without the
    extension it reports what to do and changes nothing; the searches keep
    working, just sequentially. The boot after the extension is enabled
    creates the indexes.
    """

    help = "Creates the pg_trgm extension and discovery's trigram indexes, if it can."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write("Not PostgreSQL; nothing to do.")
            return

        if not self._ensure_extension():
            return

        failed = []
        for name, table, column in INDEXES:
            error = self._create_index(name, table, column)
            if error is not None:
                failed.append(f"{name}: {error}")

        if failed:
            # Creating an index needs ownership of the table, which the role
            # running this may not have. Report and carry on — an index that
            # is only a speed-up must never stop the container from booting.
            self.stdout.write(
                self.style.WARNING(
                    "Could not create {} of {} trigram index(es):\n  {}".format(
                        len(failed), len(INDEXES), "\n  ".join(failed)
                    )
                )
            )
            return
        self.stdout.write(self.style.SUCCESS(f"{len(INDEXES)} trigram index(es) in place."))

    def _create_index(self, name: str, table: str, column: str) -> str | None:
        """Creates one index, returning None on success or the error text."""
        try:
            # Its own transaction, so one failure leaves the others standing.
            # CONCURRENTLY would need autocommit instead; these tables are
            # small enough that the plain form's brief write lock is fine.
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(
                    f'CREATE INDEX IF NOT EXISTS "{name}" '
                    f'ON "{table}" USING gin ("{column}" gin_trgm_ops)'
                )
        except DatabaseError as exc:
            return f"{exc.__class__.__name__}: {exc}".strip()
        return None

    def _ensure_extension(self) -> bool:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")
            if cursor.fetchone():
                return True

        try:
            # Its own transaction: a privilege error here must not poison the
            # connection for whatever runs next in startup.sh.
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        except DatabaseError as exc:
            self.stdout.write(
                self.style.WARNING(
                    f"pg_trgm is not available ({exc.__class__.__name__}: {exc}).\n"
                    "Discovery search still works, but scans every row. To enable it, "
                    "add pg_trgm to the server's azure.extensions parameter, then run "
                    "CREATE EXTENSION pg_trgm; as an admin role. This command picks it "
                    "up on the next boot."
                )
            )
            return False
        return True
