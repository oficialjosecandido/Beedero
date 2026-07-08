from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from analytics.models import ProfileView

DEFAULT_RETENTION_DAYS = 180


class Command(BaseCommand):
    """P1.6: `ProfileView` is append-only (one row per non-member view, see
    the model docstring) so it grows without bound. Run this on a schedule
    (cron/Azure WebJob — no scheduler is wired into this repo yet) to keep
    the table bounded."""

    help = "Deletes ProfileView rows older than --days (default 180)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=DEFAULT_RETENTION_DAYS,
            help=f"Retention window in days (default {DEFAULT_RETENTION_DAYS}).",
        )

    def handle(self, *args, **options):
        days = options["days"]
        cutoff = timezone.now() - timedelta(days=days)
        deleted, _ = ProfileView.objects.filter(viewed_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} ProfileView row(s) older than {days} days."))
