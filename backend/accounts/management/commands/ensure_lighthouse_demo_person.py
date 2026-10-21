"""Stable public personal profile for Lighthouse / SEO / perf audits.

Creates or refreshes a fixture person at /p/lighthouse-demo — the same route
Google and Lighthouse hit for real profiles. Run once per environment:

  python manage.py ensure_lighthouse_demo_person

Audit URLs (mobile Lighthouse):
  - https://<host>/                    (homepage — indexable)
  - https://<host>/p/lighthouse-demo   (this profile — indexable)
Do not use /login for SEO audits: it is intentionally noindex.
"""

from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import InvestorProfile, SelfDeclaredExperience

User = get_user_model()

HANDLE = "lighthouse-demo"
EMAIL = "lighthouse-demo@beedero.invalid"
FULL_NAME = "Lighthouse Demo"
HEADLINE = "Founder building in public — Lighthouse fixture"
BIO = (
    "Stable public profile used for SEO and performance audits. "
    "Safe to re-run ensure_lighthouse_demo_person; it upserts this handle."
)


class Command(BaseCommand):
    help = (
        f"Ensure InvestorProfile handle={HANDLE!r} exists for public /p/{HANDLE} "
        "Lighthouse and SEO tests."
    )

    def handle(self, *args, **options):
        user, created_user = User.objects.get_or_create(
            email=EMAIL,
            defaults={
                "username": HANDLE,
                "is_active": True,
                "is_internal": True,
                "email_verified_at": timezone.now(),
            },
        )
        if created_user:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        else:
            # Keep the fixture out of product metrics if it already existed.
            changed = []
            if not user.is_internal:
                user.is_internal = True
                changed.append("is_internal")
            if user.email_verified_at is None:
                user.email_verified_at = timezone.now()
                changed.append("email_verified_at")
            if changed:
                user.save(update_fields=changed)

        # Free the handle if another profile somehow owns it.
        InvestorProfile.objects.filter(handle=HANDLE).exclude(user=user).update(handle=None)

        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        profile.full_name = FULL_NAME
        profile.headline = HEADLINE
        profile.bio = BIO
        profile.country = "PT"
        profile.city = "Lisbon"
        profile.handle = HANDLE
        profile.skills = ["Product", "Growth", "Fundraising"]
        profile.visibility = {key: "public" for key in InvestorProfile.DEFAULT_VISIBILITY}
        profile.attestation_prefs = dict(InvestorProfile.DEFAULT_ATTESTATION_PREFS)
        if not profile.onboarding_completed_at:
            profile.onboarding_completed_at = timezone.now()
        profile.save()

        SelfDeclaredExperience.objects.update_or_create(
            user=user,
            org_name="Beedero",
            started_on=date(2024, 1, 1),
            defaults={
                "kind": SelfDeclaredExperience.Kind.WORK,
                "role": "Founder",
                "description": "Building the trust network for people in motion.",
                "ended_on": None,
                "skills": ["Product", "Growth"],
            },
        )

        action = "Created" if created_user else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} public profile /p/{HANDLE} (user={user.email}). "
                f"Audit this URL and / — not /login."
            )
        )
