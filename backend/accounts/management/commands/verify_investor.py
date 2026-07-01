from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import InvestorProfile

User = get_user_model()


class Command(BaseCommand):
    """Verificação manual de investidor (§8 item 3): habilita o role
    verified_investor, usado pelo VisibilityResolver para grants de fundraise."""

    help = "Marca o InvestorProfile de um utilizador como verificado."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument("--revoke", action="store_true", help="Remove a verificação em vez de a conceder.")

    def handle(self, *args, **options):
        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise CommandError(f"Não existe utilizador com email {email!r}.") from exc

        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        if options["revoke"]:
            profile.is_verified = False
            profile.verified_at = None
            self.stdout.write(self.style.WARNING(f"Verificação removida para {email}."))
        else:
            profile.is_verified = True
            profile.verified_at = timezone.now()
            self.stdout.write(self.style.SUCCESS(f"{email} verificado como investidor."))
        profile.save()
