"""Queue a send, then work through it in small batches.

Queueing writes one NewsletterDelivery per address, all at once; each batch
takes the next pending ones with `SKIP LOCKED`, so two browser tabs (or the
tab and the daily safety-net job) never send the same email twice, and a
send that stops half way resumes where it stopped.
"""

import logging

import sentry_sdk
from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework.exceptions import ValidationError

from . import audience
from .models import NewsletterDelivery, NewsletterRecipient, NewsletterSend
from .render import newsletter_html

logger = logging.getLogger(__name__)

UNSUBSCRIBE_SALT = "newsletter-unsubscribe"
BATCH_SIZE = 25


# ------------------------------------------------------------ unsubscribe


def unsubscribe_token(delivery_id: int) -> str:
    return signing.dumps(delivery_id, salt=UNSUBSCRIBE_SALT)


def unsubscribe_urls(delivery_id: int) -> tuple[str, str]:
    """(the link people click, the one-click URL mail apps POST to)."""
    token = unsubscribe_token(delivery_id)
    page = f"{settings.FRONTEND_URL.rstrip('/')}/unsubscribe?token={token}"
    one_click = f"{settings.BACKEND_URL}/api/newsletter/unsubscribe/?token={token}"
    return page, one_click


def unsubscribe(token: str) -> NewsletterDelivery:
    try:
        delivery_id = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature as exc:
        raise ValidationError({"token": ["This link is not valid."]}) from exc
    delivery = NewsletterDelivery.objects.select_related("user", "contact").filter(pk=delivery_id).first()
    if delivery is None:
        raise ValidationError({"token": ["This link is not valid."]})
    now = timezone.now()
    if delivery.user_id:
        from notifications.models import NotificationPreference

        NotificationPreference.objects.update_or_create(
            user_id=delivery.user_id, defaults={"newsletter_opt_in": False, "newsletter_opt_in_at": None}
        )
    contact = delivery.contact or NewsletterRecipient.objects.filter(email__iexact=delivery.email).first()
    if contact and contact.unsubscribed_at is None:
        contact.unsubscribed_at = now
        contact.save(update_fields=["unsubscribed_at"])
    if delivery.unsubscribed_at is None:
        delivery.unsubscribed_at = now
        delivery.save(update_fields=["unsubscribed_at"])
    return delivery


# ------------------------------------------------------------------ send


def _message(send: NewsletterSend, to: str, delivery_id: int | None) -> EmailMultiAlternatives:
    page_url = one_click = None
    if delivery_id is not None and send.kind == NewsletterSend.Kind.NEWSLETTER:
        page_url, one_click = unsubscribe_urls(delivery_id)
    html = newsletter_html(kind=send.kind, subject=send.subject, body=send.body, unsubscribe_url=page_url)
    headers = {}
    if one_click:
        headers = {"List-Unsubscribe": f"<{one_click}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
    message = EmailMultiAlternatives(
        send.subject, strip_tags(html), settings.DEFAULT_FROM_EMAIL, [to], headers=headers
    )
    message.attach_alternative(html, "text/html")
    message.wait_for_delivery = False
    return message


def send_test(send: NewsletterSend, to: str) -> None:
    message = _message(send, to, None)
    message.subject = f"[TEST] {send.subject}"
    message.send()


def queue(send: NewsletterSend, *, expected_count: int) -> NewsletterSend:
    """Draft → sending. `expected_count` is the number the author saw next to
    the Send button: if the audience changed in between, nothing goes out."""
    if send.status != NewsletterSend.Status.DRAFT:
        raise ValidationError({"detail": "This email has already been sent."})
    if not send.subject.strip() or not send.body.strip():
        raise ValidationError({"detail": "Write a subject and a message first."})
    segment = audience.SEGMENTS_BY_KEY.get(send.segment)
    if segment is None or segment.kind != send.kind:
        raise ValidationError({"segment": ["Choose who it goes to."]})
    rows = audience.recipients(send.segment)
    if len(rows) != expected_count:
        raise ValidationError(
            {"detail": f"The audience changed to {len(rows)} people. Check it and send again."}
        )
    if not rows:
        raise ValidationError({"detail": "Nobody is in this audience yet."})
    with transaction.atomic():
        locked = NewsletterSend.objects.select_for_update().get(pk=send.pk)
        if locked.status != NewsletterSend.Status.DRAFT:
            raise ValidationError({"detail": "This email has already been sent."})
        NewsletterDelivery.objects.bulk_create(
            [NewsletterDelivery(send=locked, email=email, user_id=uid, contact_id=cid) for email, uid, cid in rows],
            ignore_conflicts=True,
            batch_size=500,
        )
        locked.html_content = newsletter_html(kind=locked.kind, subject=locked.subject, body=locked.body)
        locked.status = NewsletterSend.Status.SENDING
        locked.queued_at = timezone.now()
        locked.recipient_count = len(rows)
        locked.save()
    return locked


def progress(send: NewsletterSend) -> dict:
    counts = {status: 0 for status in NewsletterDelivery.Status.values}
    for status in send.deliveries.values_list("status", flat=True):
        counts[status] += 1
    return {
        "status": send.status,
        "total": send.recipient_count,
        "sent": counts["sent"],
        "failed": counts["failed"],
        "pending": counts["pending"],
        "unsubscribed": send.deliveries.filter(unsubscribed_at__isnull=False).count(),
    }


def process_batch(send: NewsletterSend, limit: int = BATCH_SIZE) -> dict:
    if send.status != NewsletterSend.Status.SENDING:
        return progress(send)
    with transaction.atomic():
        batch = list(
            NewsletterDelivery.objects.select_for_update(skip_locked=True)
            .filter(send=send, status=NewsletterDelivery.Status.PENDING)
            .order_by("id")[:limit]
        )
        for delivery in batch:
            try:
                _message(send, delivery.email, delivery.id).send()
            except Exception as exc:  # one bad address must not stop the rest
                sentry_sdk.capture_exception(exc)
                delivery.status = NewsletterDelivery.Status.FAILED
                delivery.error = str(exc)[:300]
            else:
                delivery.status = NewsletterDelivery.Status.SENT
                delivery.sent_at = timezone.now()
            delivery.save(update_fields=["status", "error", "sent_at"])

    if not send.deliveries.filter(status=NewsletterDelivery.Status.PENDING).exists():
        NewsletterSend.objects.filter(pk=send.pk, status=NewsletterSend.Status.SENDING).update(
            status=NewsletterSend.Status.SENT,
            finished_at=timezone.now(),
            failed_count=send.deliveries.filter(status=NewsletterDelivery.Status.FAILED).count(),
        )
        send.refresh_from_db()
    return progress(send)


def process_all_pending(limit_per_send: int = 500) -> dict:
    """The daily safety net (management command): finishes sends whose tab
    was closed before the last batch."""
    done = {}
    for send in NewsletterSend.objects.filter(status=NewsletterSend.Status.SENDING):
        sent = 0
        while sent < limit_per_send and send.status == NewsletterSend.Status.SENDING:
            before = send.deliveries.filter(status=NewsletterDelivery.Status.PENDING).count()
            if not before:
                process_batch(send)
                break
            process_batch(send)
            sent += min(before, BATCH_SIZE)
            send.refresh_from_db()
        done[send.pk] = progress(send)
    return done
