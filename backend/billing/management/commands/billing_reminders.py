from django.core.management.base import BaseCommand

from billing.subscriptions import send_free_period_reminders


class Command(BaseCommand):
    help = "Warns owners before a free year ends (30/7/1 days) and pauses the ones that ended."

    def handle(self, *args, **options):
        counts = send_free_period_reminders()
        self.stdout.write(self.style.SUCCESS(f"Reminded {counts['reminded']}, paused {counts['paused']}."))
