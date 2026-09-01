from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_date

from analytics.site_traffic import compute_daily_site_stats


class Command(BaseCommand):
    help = "Computes DailySiteStats for --date (default: yesterday)."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, default=None, help="ISO date to compute (default: yesterday).")

    def handle(self, *args, **options):
        target_date = (
            parse_date(options["date"])
            if options["date"]
            else timezone.localdate() - timedelta(days=1)
        )
        row = compute_daily_site_stats(target_date)
        self.stdout.write(
            self.style.SUCCESS(
                f"Computed DailySiteStats for {target_date}: "
                f"{row.page_views} views, {row.unique_visitors} visitors."
            )
        )
