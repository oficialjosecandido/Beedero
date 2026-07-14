"""Doc §4: minimal weekly digest — profile views, new followers, one nudge.
Non-negotiable (doc §6): a week with zero signal must NOT send an email.
No Celery/Redis here — run via the existing scheduled-job mechanism
(beedero/views.run_management_job), once a week.
"""

from datetime import timedelta

import sentry_sdk
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from django.utils.html import escape

from analytics.models import ProfileView
from notifications.models import DigestSend, NotificationPreference
from notifications.views import digest_pixel_token, digest_unsubscribe_token
from orgs.models import OrgFollow, OrgMembership, Organization


def _nudge_for(org) -> str:
    if not org.is_fundraising:
        return "Consider opening a fundraising round if you're raising — it unlocks a dedicated tab for investors."
    if not OrgFollow.objects.filter(org=org).exists():
        return "Share your profile link with a few investors to get your first followers."
    return "Post an update this week — profiles that post regularly get more visits."


class Command(BaseCommand):
    help = "Sends the weekly digest email to org owners/admins whose org had signal this week."

    def handle(self, *args, **options):
        week_ago = timezone.now() - timedelta(days=7)
        sent = 0

        for org in Organization.objects.filter(status=Organization.Status.LIVE):
            profile_views = ProfileView.objects.filter(org=org, viewed_at__gte=week_ago).count()
            new_followers = OrgFollow.objects.filter(org=org, created_at__gte=week_ago).count()
            if profile_views == 0 and new_followers == 0:
                continue  # zero-signal week — never send (doc §6)

            nudge = _nudge_for(org)
            owners = (
                OrgMembership.objects.filter(
                    org=org, role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
                )
                .select_related("user")
                .annotate(
                    wants_digest=Subquery(
                        NotificationPreference.objects.filter(user_id=OuterRef("user_id")).values(
                            "digest_email"
                        )[:1]
                    )
                )
            )
            for membership in owners:
                if membership.wants_digest is False:
                    continue
                user = membership.user
                digest_send = DigestSend.objects.create(user=user)
                unsub_url = f"{settings.BACKEND_URL}/api/notifications/digest/unsubscribe/?token={digest_unsubscribe_token(user.id)}"
                pixel_url = f"{settings.BACKEND_URL}/api/notifications/digest/pixel.gif?token={digest_pixel_token(digest_send.id)}"
                text_body = (
                    f"Your weekly Beedero summary for {org.name}:\n\n"
                    f"- Profile views: {profile_views}\n"
                    f"- New followers: {new_followers}\n\n"
                    f"Suggestion: {nudge}\n\n"
                    f"Unsubscribe from this weekly digest: {unsub_url}\n"
                )
                html_body = (
                    f"<p>Your weekly Beedero summary for <strong>{escape(org.name)}</strong>:</p>"
                    f"<ul><li>Profile views: {profile_views}</li><li>New followers: {new_followers}</li></ul>"
                    f"<p>Suggestion: {escape(nudge)}</p>"
                    f'<p><a href="{escape(unsub_url)}">Unsubscribe from this weekly digest</a></p>'
                    f'<img src="{escape(pixel_url)}" width="1" height="1" alt="" style="display:none">'
                )
                message = EmailMultiAlternatives(
                    f"Your week on Beedero — {org.name}",
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

        self.stdout.write(self.style.SUCCESS(f"Sent {sent} weekly digest email(s)."))
