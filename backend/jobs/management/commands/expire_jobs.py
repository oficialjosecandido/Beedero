from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.models import Notification
from notifications.services import notify

from ...models import JobPost
from ...services import org_admins

# Job TTL is only 7 days (spec §3b), so warnings sit closer to expiry than
# credibility/expire_verifications.py's D-30/D-7/D-1 — D-2 and D-0 only.
WARNING_WINDOWS_DAYS = (2, 0)

FORBIDDEN_URGENCY_PHRASES = ("only today", "last chance", "you are losing", "act now", "don't miss")


def expiry_warning_message(job, days_left: int) -> str:
    if days_left == 0:
        return f"Your job post '{job.title}' expires today. Renew it to keep it visible."
    return f"Your job post '{job.title}' expires in {days_left} days. Renew it to keep it visible."


def _message_is_factual(message: str) -> bool:
    lowered = message.lower()
    return not any(phrase in lowered for phrase in FORBIDDEN_URGENCY_PHRASES)


class Command(BaseCommand):
    help = "Closes JobPost rows past expires_at and sends D-2/D-0 renewal warnings."

    def handle(self, *args, **options):
        now = timezone.now()

        expired = JobPost.objects.filter(status=JobPost.Status.OPEN, expires_at__lt=now)
        expired_count = expired.update(status=JobPost.Status.CLOSED)

        warned_count = 0
        for days in WARNING_WINDOWS_DAYS:
            window_start = now + timedelta(days=days)
            window_end = window_start + timedelta(days=1)
            about_to_expire = JobPost.objects.filter(
                status=JobPost.Status.OPEN,
                expires_at__gte=window_start,
                expires_at__lt=window_end,
            ).select_related("org")
            for job in about_to_expire:
                message = expiry_warning_message(job, days)
                assert _message_is_factual(message)
                aggregate_key = f"job_expiring:{job.id}:{days}"
                for admin in org_admins(job.org):
                    already_sent = Notification.objects.filter(
                        user=admin, kind=Notification.Kind.JOB_EXPIRING, aggregate_key=aggregate_key
                    ).exists()
                    if already_sent:
                        continue
                    notify(
                        admin,
                        kind=Notification.Kind.JOB_EXPIRING,
                        aggregate_key=aggregate_key,
                        title="Job post expiring soon",
                        body=message,
                        link=f"/dashboard/{job.org.slug}",
                    )
                    warned_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Closed {expired_count} job(s), sent {warned_count} warning(s).")
        )
