"""Stable public fixtures for Lighthouse / SEO / perf audits.

Creates or refreshes:
  - Person profile at /p/lighthouse-demo
  - Organisation at /o/lighthouse-demo (public org page)

Also prefer the static frontend dashboard at /lighthouse-demo — that route
never depends on this seed and is the primary audit URL.

  python manage.py ensure_lighthouse_demo_person

Audit URLs (mobile Lighthouse):
  - https://<host>/lighthouse-demo     (static public dashboard — preferred)
  - https://<host>/                    (homepage — indexable)
  - https://<host>/o/lighthouse-demo   (this org — indexable once seeded)
  - https://<host>/p/lighthouse-demo   (this profile — indexable once seeded)
Do not use /login for SEO audits: it is intentionally noindex.
"""

from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import InvestorProfile, SelfDeclaredExperience
from billing.testing import grant_plan
from orgs.constants import SectionKind
from orgs.models import Activity, Organization, OrgField, OrgMembership, Visibility

User = get_user_model()

HANDLE = "lighthouse-demo"
ORG_SLUG = "lighthouse-demo"
EMAIL = "lighthouse-demo@beedero.invalid"
FULL_NAME = "Lighthouse Demo"
HEADLINE = "Founder building in public — Lighthouse fixture"
BIO = (
    "Stable public profile used for SEO and performance audits. "
    "Safe to re-run ensure_lighthouse_demo_person; it upserts this handle."
)
ORG_NAME = "Lighthouse Demo"
ORG_ONE_LINER = "Public organisation dashboard fixture for Lighthouse and SEO audits."


class Command(BaseCommand):
    help = (
        f"Ensure public fixtures handle/slug={HANDLE!r} for /p/{HANDLE}, "
        f"/o/{ORG_SLUG}, and Lighthouse / SEO tests."
    )

    def handle(self, *args, **options):
        user = self._ensure_person()
        org = self._ensure_org(user)
        self.stdout.write(
            self.style.SUCCESS(
                f"Public fixtures ready: /lighthouse-demo (static), "
                f"/p/{HANDLE}, /o/{org.slug} (user={user.email}). "
                f"Prefer /lighthouse-demo for audits — not /login."
            )
        )

    def _ensure_person(self):
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
        return user

    def _ensure_org(self, owner):
        org, created = Organization.objects.get_or_create(
            slug=ORG_SLUG,
            defaults={
                "name": ORG_NAME,
                "one_liner": ORG_ONE_LINER,
                "status": Organization.Status.LIVE,
                "stage": "seed",
                "sector": "marketplace",
                "geo": "lisbon",
            },
        )
        if not created:
            org.name = ORG_NAME
            org.one_liner = ORG_ONE_LINER
            org.status = Organization.Status.LIVE
            org.stage = org.stage or "seed"
            org.sector = org.sector or "marketplace"
            org.geo = org.geo or "lisbon"
            org.save()

        OrgMembership.objects.update_or_create(
            org=org,
            user=owner,
            defaults={"role": OrgMembership.Role.OWNER, "title": "Founder"},
        )
        grant_plan(org)

        about = org.sections.get(kind=SectionKind.ABOUT)
        OrgField.objects.update_or_create(
            section=about,
            key="summary",
            defaults={
                "value": (
                    "Public organisation dashboard fixture for Lighthouse, SEO and "
                    "performance audits. Safe to re-run; content is upserted."
                ),
                "visibility": Visibility.PUBLIC,
            },
        )
        OrgField.objects.update_or_create(
            section=about,
            key="mission",
            defaults={
                "value": "Give auditors a stable Beedero public org surface that never looks empty.",
                "visibility": Visibility.PUBLIC,
            },
        )

        if not Activity.objects.filter(org=org, title="Opened the seed round").exists():
            Activity.objects.create(
                org=org,
                kind=Activity.Kind.NEWS,
                title="Opened the seed round",
                body="Fixture update for public audits — not a real fundraise.",
                occurred_at=timezone.now(),
                visibility=Visibility.PUBLIC,
            )
        return org
