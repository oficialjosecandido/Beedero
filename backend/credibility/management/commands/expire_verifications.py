from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from credibility.models import Verification
from credibility.services import notify_org_owners

# Warning windows, doc §5 ("D-30/D-7 notices"). No scheduler is wired into
# this repo yet (same gap as analytics.prune_profile_views) — run this daily
# via cron/Azure WebJob. There's no `warned_at` field to dedupe repeat sends,
# so each window is a narrow one-day slice assuming a daily run; running the
# command more than once a day, or skipping a day, will under/over-send a
# notice rather than corrupt any state — acceptable for an MVP notice, not
# worth a new column to make idempotent.
WARNING_WINDOWS_DAYS = (30, 7)


class Command(BaseCommand):
    help = "Expires Verification rows past valid_until and sends D-30/D-7 renewal warnings."

    def handle(self, *args, **options):
        now = timezone.now()

        expired = Verification.objects.filter(status=Verification.Status.VERIFIED, valid_until__lt=now)
        expired_count = 0
        for verification in expired:
            verification.status = Verification.Status.EXPIRED
            verification.save(update_fields=["status"])
            notify_org_owners(
                verification.org,
                f"Your '{verification.get_type_display()}' verification has expired. "
                "Resubmit it to keep your credibility level.",
            )
            expired_count += 1

        warned_count = 0
        for days in WARNING_WINDOWS_DAYS:
            window_start = now + timedelta(days=days)
            window_end = window_start + timedelta(days=1)
            about_to_expire = Verification.objects.filter(
                status=Verification.Status.VERIFIED,
                valid_until__gte=window_start,
                valid_until__lt=window_end,
            )
            for verification in about_to_expire:
                notify_org_owners(
                    verification.org,
                    f"Your '{verification.get_type_display()}' verification expires in "
                    f"~{days} days. Resubmit it soon to keep your credibility level.",
                )
                warned_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Expired {expired_count} verification(s), sent {warned_count} warning(s).")
        )
