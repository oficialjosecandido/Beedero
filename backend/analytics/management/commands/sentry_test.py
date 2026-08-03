from django.core.management.base import BaseCommand
import sentry_sdk


class Command(BaseCommand):
    help = "Emit a test event to Sentry (production ops check)."

    def handle(self, *args, **options):
        sentry_sdk.capture_message("Beedero management sentry_test OK", level="info")
        self.stdout.write(self.style.SUCCESS("Sentry test event sent."))
