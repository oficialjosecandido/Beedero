"""The two scheduled halves of a team invite's life (doc aquisição §2.2).

One command, not two, because they are the same clock: an invite that turned
three days old needs its single reminder, and one that turned thirty needs
closing and its address forgetting. Running them together also means the
reminder can never be sent to an invite that expired in the meantime.
"""

from django.core.management.base import BaseCommand

from ...team_invites import expire_invites, send_due_reminders


class Command(BaseCommand):
    help = "Sends the one due team-invite reminder and expires invites past 30 days."

    def handle(self, *args, **options):
        # Expiry first: an invite past its date must not get a reminder on the
        # way out.
        expired = expire_invites()
        reminded = send_due_reminders()
        self.stdout.write(
            self.style.SUCCESS(f"Expired {expired} invite(s), sent {reminded} reminder(s).")
        )
