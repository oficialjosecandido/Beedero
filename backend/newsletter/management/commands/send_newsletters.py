from django.core.management.base import BaseCommand

from newsletter.sending import process_all_pending


class Command(BaseCommand):
    help = "Finishes newsletter sends left half way (the Nexus normally sends them while its page is open)."

    def handle(self, *args, **options):
        self.stdout.write(str(process_all_pending()))
