from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from credibility.levels import credibility_level
from credibility.models import Verification
from credibility.services import notify_org_owners
from notifications.services import notify_verification_update

# Factual expiry warnings only — D-30, D-7, D-1 (doc §B1). No fabricated urgency.
WARNING_WINDOWS_DAYS = (30, 7, 1)

FORBIDDEN_URGENCY_PHRASES = ("only today", "last chance", "you are losing", "act now", "don't miss")


def expiry_warning_message(org, days_left: int) -> str:
    level = credibility_level(org)
    return (
        f"Your Beedero seal (level {level}) expires in {days_left} days. "
        "Renew your verifications to keep your level and your live badge."
    )


def _message_is_factual(message: str) -> bool:
    lowered = message.lower()
    return not any(phrase in lowered for phrase in FORBIDDEN_URGENCY_PHRASES)


class Command(BaseCommand):
    help = "Expires Verification rows past valid_until and sends D-30/D-7/D-1 renewal warnings."

    def handle(self, *args, **options):
        now = timezone.now()

        expired = Verification.objects.filter(status=Verification.Status.VERIFIED, valid_until__lt=now)
        expired_count = 0
        for verification in expired:
            verification.status = Verification.Status.EXPIRED
            verification.save(update_fields=["status"])
            org = verification.org
            message = (
                f"Your '{verification.get_type_display()}' verification has expired. "
                "Resubmit it to keep your credibility level — your embeddable badge will reflect this."
            )
            notify_org_owners(org, message)
            notify_verification_update(org, message)
            expired_count += 1

        warned_count = 0
        for days in WARNING_WINDOWS_DAYS:
            window_start = now + timedelta(days=days)
            window_end = window_start + timedelta(days=1)
            about_to_expire = Verification.objects.filter(
                status=Verification.Status.VERIFIED,
                valid_until__gte=window_start,
                valid_until__lt=window_end,
            ).select_related("org")
            seen_orgs = set()
            for verification in about_to_expire:
                org = verification.org
                if org.id in seen_orgs:
                    continue
                seen_orgs.add(org.id)
                message = expiry_warning_message(org, days)
                assert _message_is_factual(message)
                notify_org_owners(org, message)
                notify_verification_update(org, message)
                warned_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Expired {expired_count} verification(s), sent {warned_count} warning(s).")
        )
