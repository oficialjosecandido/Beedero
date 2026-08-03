"""Weekly investor alerts: thesis matches + pipeline activity."""

from datetime import timedelta

import sentry_sdk
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.html import escape

from accounts.models import InvestorProfile
from analytics.models import PipelineEntry
from credibility.levels import credibility_level
from notifications.models import DigestSend, NotificationPreference
from notifications.views import digest_pixel_token, digest_unsubscribe_token
from orgs.models import Activity, Organization

User = get_user_model()


def matching_orgs_for(profile: InvestorProfile, since):
    qs = Organization.objects.filter(status=Organization.Status.LIVE, created_at__gte=since)
    if profile.stage_focus:
        qs = qs.filter(stage__in=profile.stage_focus)
    if profile.sector_focus:
        qs = qs.filter(sector__in=profile.sector_focus)
    if profile.geo_focus:
        qs = qs.filter(geo__in=profile.geo_focus)
    candidates = list(qs)
    return sorted(candidates, key=lambda org: (-credibility_level(org), org.name))[:5]


def pipeline_updates_for(user, since):
    org_ids = PipelineEntry.objects.filter(investor=user).exclude(
        stage=PipelineEntry.Stage.PASSED
    ).values_list("org_id", flat=True)
    if not org_ids:
        return []
    activities = (
        Activity.objects.filter(org_id__in=org_ids, created_at__gte=since)
        .select_related("org")
        .order_by("-created_at")[:5]
    )
    return list(activities)


class Command(BaseCommand):
    help = "Sends weekly investor alert emails for thesis matches and pipeline updates."

    def handle(self, *args, **options):
        week_ago = timezone.now() - timedelta(days=7)
        sent = 0
        frontend = settings.FRONTEND_URL.rstrip("/")

        profiles = InvestorProfile.objects.exclude(full_name="").select_related("user")
        for profile in profiles:
            user = profile.user
            matches = matching_orgs_for(profile, week_ago)
            updates = pipeline_updates_for(user, week_ago)

            pending_actions = PipelineEntry.objects.filter(
                investor=user,
                next_action_at__lte=timezone.localdate(),
            ).exclude(stage__in=[PipelineEntry.Stage.PASSED, PipelineEntry.Stage.INVESTED]).count()

            if not matches and not updates and pending_actions == 0:
                continue

            pref = NotificationPreference.objects.filter(user=user).values_list("digest_email", flat=True).first()
            if pref is False:
                continue

            lines = []
            if matches:
                lines.append(f"{len(matches)} new startup(s) matching your thesis:")
                for org in matches:
                    lines.append(f"  • {org.name} — {frontend}/o/{org.slug}")
            if updates:
                lines.append(f"{len(updates)} update(s) from startups in your pipeline:")
                for activity in updates:
                    lines.append(f"  • {activity.org.name}: {activity.title}")
            if pending_actions:
                lines.append(f"{pending_actions} pipeline item(s) need your attention today.")

            text_body = "Your weekly Beedero investor summary:\n\n" + "\n".join(lines)
            html_parts = ["<p>Your weekly Beedero investor summary:</p>"]
            if matches:
                html_parts.append(
                    f"<p><strong>{len(matches)} new thesis match(es)</strong></p><ul>"
                    + "".join(
                        f"<li>{escape(org.name)} — {escape(frontend)}/o/{escape(org.slug)}</li>"
                        for org in matches
                    )
                    + "</ul>"
                )
            if updates:
                html_parts.append(
                    "<p><strong>Pipeline updates</strong></p><ul>"
                    + "".join(
                        f"<li>{escape(activity.org.name)}: {escape(activity.title)}</li>"
                        for activity in updates
                    )
                    + "</ul>"
                )
            if pending_actions:
                html_parts.append(f"<p><strong>{pending_actions} pipeline reminder(s) due today</strong></p>")

            digest_send = DigestSend.objects.create(user=user)
            unsub_url = (
                f"{settings.BACKEND_URL}/api/notifications/digest/unsubscribe/"
                f"?token={digest_unsubscribe_token(user.id)}"
            )
            pixel_url = (
                f"{settings.BACKEND_URL}/api/notifications/digest/pixel.gif"
                f"?token={digest_pixel_token(digest_send.id)}"
            )
            html_body = (
                "".join(html_parts)
                + f'<p><a href="{escape(unsub_url)}">Unsubscribe from weekly emails</a></p>'
                + f'<img src="{escape(pixel_url)}" width="1" height="1" alt="" style="display:none">'
            )

            message = EmailMultiAlternatives(
                "Your week on Beedero — investor summary",
                text_body + f"\n\nUnsubscribe: {unsub_url}\n",
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
            )
            message.attach_alternative(html_body, "text/html")
            try:
                message.send()
                sent += 1
            except Exception as exc:
                sentry_sdk.capture_exception(exc)

        self.stdout.write(self.style.SUCCESS(f"Sent {sent} investor alert email(s)."))
