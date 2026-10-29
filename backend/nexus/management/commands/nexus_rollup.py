from django.core.management.base import BaseCommand

from nexus.rollup import compute


class Command(BaseCommand):
    help = "Counts connections, messages, reactions, comments and posts per day for the Nexus."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days", type=int, default=2, help="How many days to (re)count, today included. 2 by default."
        )

    def handle(self, *args, days, **options):
        rows = compute(days=days)
        self.stdout.write(f"{len(rows)} day(s) counted")
