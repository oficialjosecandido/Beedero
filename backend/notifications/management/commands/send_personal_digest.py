"""Personal weekly reflection digest — real, already-earned signal only
(doc "Fazer os Utilizadores Sentirem-se Valorizados" §6 item 1). Same
non-negotiable rule as send_weekly_digest.py, applied to people instead of
orgs: a week with zero signal must NOT send an email.
"""

from datetime import timedelta

import sentry_sdk
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.html import escape

from accounts.models import InvestorProfile
from accounts.timeline import verified_facts_count
from affiliations.models import Affiliation
from analytics.models import PersonProfileView
from credibility.models import ProfessionalCredential
from notifications.models import DigestSend, NotificationPreference
from notifications.views import digest_pixel_token, digest_unsubscribe_token
from orgs.models import Organization


class Command(BaseCommand):
    help = "Sends the weekly personal reflection digest to people who had real signal this week."

    def handle(self, *args, **options):
        week_ago = timezone.now() - timedelta(days=7)
        sent = 0

        profiles = (
            InvestorProfile.objects.exclude(full_name="")
            .exclude(headline="")
            .exclude(country="")
            .select_related("user")
        )
        for profile in profiles:
            user = profile.user
            pref = (
                NotificationPreference.objects.filter(user=user)
                .values_list("digest_email", flat=True)
                .first()
            )
            if pref is False:
                continue

            investor_views = (
                PersonProfileView.objects.filter(
                    subject=user, viewed_at__gte=week_ago, viewer__investorprofile__is_verified=True
                )
                .values("viewer")
                .distinct()
                .count()
            )
            new_verified_facts = (
                Affiliation.objects.filter(
                    user=user,
                    org__status=Organization.Status.LIVE,
                    status=Affiliation.Status.VERIFIED,
                    verified_at__gte=week_ago,
                ).count()
                + ProfessionalCredential.objects.filter(
                    user=user, status=ProfessionalCredential.Status.VERIFIED, verified_at__gte=week_ago
                ).count()
            )
            if investor_views == 0 and new_verified_facts == 0:
                continue  # zero-signal week — never send (doc's non-negotiable rule)

            lines = []
            if investor_views:
                plural = "investor" if investor_views == 1 else "investors"
                lines.append(f"{investor_views} verified {plural} viewed your profile this week.")
            if new_verified_facts:
                plural = "fact" if new_verified_facts == 1 else "facts"
                lines.append(f"{new_verified_facts} new verified {plural} joined your journey this week.")
            lines.append(f"Your journey now has {verified_facts_count(user)} verified facts in total.")

            digest_send = DigestSend.objects.create(user=user)
            unsub_url = (
                f"{settings.BACKEND_URL}/api/notifications/digest/unsubscribe/"
                f"?token={digest_unsubscribe_token(user.id)}"
            )
            pixel_url = (
                f"{settings.BACKEND_URL}/api/notifications/digest/pixel.gif"
                f"?token={digest_pixel_token(digest_send.id)}"
            )
            text_body = (
                "Your week on Beedero:\n\n"
                + "\n".join(f"- {line}" for line in lines)
                + f"\n\nUnsubscribe from this weekly digest: {unsub_url}\n"
            )
            html_body = (
                "<p>Your week on Beedero:</p><ul>"
                + "".join(f"<li>{escape(line)}</li>" for line in lines)
                + "</ul>"
                + f'<p><a href="{escape(unsub_url)}">Unsubscribe from this weekly digest</a></p>'
                + f'<img src="{escape(pixel_url)}" width="1" height="1" alt="" style="display:none">'
            )
            message = EmailMultiAlternatives(
                "Your week on Beedero",
                text_body,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
            )
            message.attach_alternative(html_body, "text/html")
            try:
                message.send()
                sent += 1
            except Exception as exc:
                sentry_sdk.capture_exception(exc)

        self.stdout.write(self.style.SUCCESS(f"Sent {sent} personal digest email(s)."))
