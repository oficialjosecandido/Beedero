from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import InvestorProfile

User = get_user_model()


class Command(BaseCommand):
    """Manual investor verification (§8 item 3): enables the
    verified_investor role, used by VisibilityResolver for fundraise grants."""

    help = "Marks a user's InvestorProfile as verified."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument("--revoke", action="store_true", help="Remove the verification instead of granting it.")

    def handle(self, *args, **options):
        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise CommandError(f"No user exists with email {email!r}.") from exc

        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        if options["revoke"]:
            profile.is_verified = False
            profile.verified_at = None
            self.stdout.write(self.style.WARNING(f"Verification removed for {email}."))
        else:
            profile.is_verified = True
            profile.verified_at = timezone.now()
            self.stdout.write(self.style.SUCCESS(f"{email} verified as investor."))
        profile.save()
