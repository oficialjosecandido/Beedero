"""Give the Nexus admin allowlist the `is_staff` flag it needs to sign in.

Two gates stand between an account and /beedero-nexus (nexus/access.py):
`is_staff`, then membership of beedero/admin_access.py::KPI_ADMIN_EMAILS. The
allowlist is in the repository, but the flag lives in the database — and
Firebase provisions every account without it, so the people on the list would
otherwise need a shell on the server to reach the panel they own.

FIRST_ADMIN_EMAIL is handled first and reported on its own line: it is the
founding admin, the account the Nexus is handed to before anyone else has it.

Idempotent, and run on every container start from startup.sh. An address with
no account yet is reported and skipped — nothing is created here, because a
`User` row without a Firebase uid cannot sign in, so it would sit dead until
its owner's first sign-in provisioned the real one.

  python manage.py ensure_nexus_admins
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from beedero.admin_access import FIRST_ADMIN_EMAIL, KPI_ADMIN_EMAILS

User = get_user_model()


def admin_emails() -> list[str]:
    """The founding admin, then the rest of the allowlist in a stable order."""
    return [FIRST_ADMIN_EMAIL, *sorted(KPI_ADMIN_EMAILS - {FIRST_ADMIN_EMAIL})]


class Command(BaseCommand):
    help = "Grant is_staff to every account on the Nexus admin allowlist."

    def handle(self, *args, **options):
        for email in admin_emails():
            role = "first admin" if email == FIRST_ADMIN_EMAIL else "admin"
            # iexact to match nexus_role, which lowercases before comparing:
            # an address stored with different case is the same admin.
            user = User.objects.filter(email__iexact=email).order_by("id").first()

            if user is None:
                self.stdout.write(f"{email} ({role}): no account yet — skipped.")
                continue
            if not user.is_staff:
                user.is_staff = True
                user.save(update_fields=["is_staff"])
                self.stdout.write(self.style.SUCCESS(f"{email} ({role}): granted is_staff."))
            else:
                self.stdout.write(f"{email} ({role}): already staff.")
            if not user.is_active:
                # Reported, not fixed: `nexus/people.py::suspend` refuses to
                # touch a staff account, so a deactivated admin was switched
                # off deliberately in the Django admin, and that stands.
                self.stdout.write(
                    self.style.WARNING(f"{email} ({role}): account is inactive — no Nexus access.")
                )
