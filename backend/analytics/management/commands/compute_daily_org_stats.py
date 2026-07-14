from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_date

from analytics.models import DailyOrgStats, ProfileView
from orgs.models import OrgFollow, Organization


class Command(BaseCommand):
    """Doc §3: nightly snapshot backing the dashboard's delta cards. No
    Celery/Redis in this repo yet (see beedero/views.run_management_job) —
    run via the existing scheduled-job mechanism, once daily, for
    "yesterday" (so the day being summarized is fully closed)."""

    help = "Computes DailyOrgStats rows for --date (default: yesterday)."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, default=None, help="ISO date to compute (default: yesterday).")

    def handle(self, *args, **options):
        target_date = parse_date(options["date"]) if options["date"] else timezone.localdate() - timedelta(days=1)
        day_start = timezone.make_aware(timezone.datetime.combine(target_date, timezone.datetime.min.time()))
        day_end = day_start + timedelta(days=1)

        updated = 0
        for org in Organization.objects.all():
            followers_count = OrgFollow.objects.filter(org=org, created_at__lt=day_end).count()
            new_followers_count = OrgFollow.objects.filter(
                org=org, created_at__gte=day_start, created_at__lt=day_end
            ).count()
            profile_views_count = ProfileView.objects.filter(
                org=org, viewed_at__gte=day_start, viewed_at__lt=day_end
            ).count()

            DailyOrgStats.objects.update_or_create(
                org=org,
                date=target_date,
                defaults={
                    "followers_count": followers_count,
                    "new_followers_count": new_followers_count,
                    "profile_views_count": profile_views_count,
                },
            )
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"Computed DailyOrgStats for {updated} org(s) on {target_date}."))
