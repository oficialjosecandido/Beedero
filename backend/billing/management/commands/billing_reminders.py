from django.core.management.base import BaseCommand

from billing.subscriptions import reprice_due, send_free_period_reminders


class Command(BaseCommand):
    help = (
        "Warns owners before a free year ends (30/7/1 days), pauses the ones that ended, and moves "
        "plans whose organisation changed kind (startup/company) to the right price."
    )

    def handle(self, *args, **options):
        counts = send_free_period_reminders()
        prices = reprice_due()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reminded {counts['reminded']}, paused {counts['paused']}. "
                f"Repriced {prices['repriced']}, waiting {prices['waiting']}, failed {prices['failed']}."
            )
        )
