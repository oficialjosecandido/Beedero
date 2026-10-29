"""The newsletter tab (admins): drafts, a real preview, a test to yourself,
then a send the page works through in batches while it stays open.

Sending needs the number of recipients the admin saw: if the audience moved
in between (someone opted in or out), nothing goes out until they look again.
"""

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from newsletter import audience, sending
from newsletter.models import NewsletterRecipient, NewsletterSend
from newsletter.render import newsletter_html
from notifications.models import NotificationPreference

from . import audit
from .access import IsNexusAdmin
from .common import iso, paginate
from .models import NexusAction


def _send(row: NewsletterSend, *, full: bool = False) -> dict:
    segment = audience.SEGMENTS_BY_KEY.get(row.segment)
    data = {
        "id": row.id,
        "subject": row.subject,
        "kind": row.kind,
        "segment": row.segment,
        "segment_label": segment.label if segment else (row.get_audience_display() if row.audience else ""),
        "status": row.status,
        "created_at": iso(row.sent_at),
        "queued_at": iso(row.queued_at),
        "finished_at": iso(row.finished_at),
        "author": row.sent_by.email if row.sent_by_id else "",
        "recipients": row.recipient_count,
        "failed": row.failed_count,
    }
    if row.status != NewsletterSend.Status.DRAFT:
        data["progress"] = sending.progress(row)
    if full:
        data["body"] = row.body
        data["preview_html"] = (
            newsletter_html(kind=row.kind, subject=row.subject or "(no subject)", body=row.body, unsubscribe_url="#")
            if row.body or row.status == NewsletterSend.Status.DRAFT
            else row.html_content
        )
        if row.status == NewsletterSend.Status.DRAFT and row.segment in audience.SEGMENTS_BY_KEY:
            data["audience_count"] = len(audience.recipients(row.segment))
    return data


def _apply(row: NewsletterSend, data) -> None:
    if "subject" in data:
        row.subject = (data.get("subject") or "").strip()[:255]
    if "body" in data:
        row.body = data.get("body") or ""
    if "kind" in data:
        if data["kind"] not in NewsletterSend.Kind.values:
            raise ValidationError({"kind": ["Unknown kind."]})
        row.kind = data["kind"]
    if "segment" in data:
        row.segment = data.get("segment") or ""
    segment = audience.SEGMENTS_BY_KEY.get(row.segment)
    if segment and segment.kind != row.kind:
        row.segment = ""


class NewsletterView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request):
        opted_in = NotificationPreference.objects.filter(
            newsletter_opt_in=True, user__in=audience.reachable_users()
        ).count()
        return Response(
            {
                "sends": [_send(row) for row in NewsletterSend.objects.select_related("sent_by")[:50]],
                "segments": audience.segment_counts(),
                "subscribers": {
                    "accounts": opted_in,
                    "contacts": NewsletterRecipient.objects.filter(unsubscribed_at__isnull=True).count(),
                    "contacts_unsubscribed": NewsletterRecipient.objects.filter(unsubscribed_at__isnull=False).count(),
                },
            }
        )

    def post(self, request):
        row = NewsletterSend(status=NewsletterSend.Status.DRAFT, sent_by=request.user)
        _apply(row, request.data)
        row.save()
        return Response(_send(row, full=True), status=201)


class NewsletterSendView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request, pk):
        return Response(_send(get_object_or_404(NewsletterSend, pk=pk), full=True))

    def patch(self, request, pk):
        row = get_object_or_404(NewsletterSend, pk=pk)
        if row.status != NewsletterSend.Status.DRAFT:
            raise ValidationError({"detail": "Only drafts can be changed."})
        _apply(row, request.data)
        row.save()
        return Response(_send(row, full=True))

    def delete(self, request, pk):
        row = get_object_or_404(NewsletterSend, pk=pk)
        if row.status != NewsletterSend.Status.DRAFT:
            raise ValidationError({"detail": "Only drafts can be deleted."})
        row.delete()
        return Response(status=204)


class NewsletterActionView(APIView):
    """test → to yourself · send → queue it · process → the next batch."""

    permission_classes = [IsNexusAdmin]

    def post(self, request, pk, action):
        row = get_object_or_404(NewsletterSend, pk=pk)
        if action == "test":
            if not row.subject.strip() or not row.body.strip():
                raise ValidationError({"detail": "Write a subject and a message first."})
            sending.send_test(row, request.user.email)
            audit.record(
                request.user, NexusAction.Action.NEWSLETTER_TEST, target_type="newsletter", target_id=row.id, label=row.subject
            )
            return Response({"sent_to": request.user.email})
        if action == "send":
            try:
                expected = int(request.data.get("expected_count"))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"detail": "Confirm the number of recipients."}) from exc
            row = sending.queue(row, expected_count=expected)
            audit.record(
                request.user,
                NexusAction.Action.NEWSLETTER_SENT,
                target_type="newsletter",
                target_id=row.id,
                label=row.subject,
                kind=row.kind,
                segment=row.segment,
                recipients=row.recipient_count,
            )
            sending.process_batch(row)
            row.refresh_from_db()
            return Response(_send(row, full=True))
        if action == "process":
            sending.process_batch(row)
            row.refresh_from_db()
            return Response(_send(row))
        return Response(status=404)


class ContactsView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request):
        queryset = NewsletterRecipient.objects.all()
        q = (request.query_params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(Q(email__icontains=q) | Q(name__icontains=q) | Q(source__icontains=q))
        rows, page = paginate(queryset.order_by("-created_at"), request)
        sources = list(
            NewsletterRecipient.objects.exclude(source="").values("source").annotate(n=Count("id")).order_by("-n")[:20]
        )
        return Response(
            {
                "results": [
                    {
                        "id": c.id,
                        "email": c.email,
                        "name": c.name,
                        "source": c.source,
                        "created_at": iso(c.created_at),
                        "unsubscribed_at": iso(c.unsubscribed_at),
                    }
                    for c in rows
                ],
                "sources": sources,
                **page,
            }
        )

    def post(self, request):
        """One address per line. `source` says where their consent came from."""
        source = (request.data.get("source") or "").strip()[:80]
        if not source:
            raise ValidationError({"source": ["Say where these people asked for the newsletter."]})
        added = skipped = existing = 0
        for line in (request.data.get("emails") or "").splitlines():
            email = line.strip().lower()
            if not email:
                continue
            try:
                validate_email(email)
            except DjangoValidationError:
                skipped += 1
                continue
            _, created = NewsletterRecipient.objects.get_or_create(email=email, defaults={"source": source})
            added += int(created)
            existing += int(not created)
        if added:
            audit.record(
                request.user, NexusAction.Action.CONTACTS_ADDED, target_type="contacts", label=source, added=added
            )
        return Response({"added": added, "already_there": existing, "invalid": skipped})


class ContactView(APIView):
    permission_classes = [IsNexusAdmin]

    def delete(self, request, pk):
        contact = get_object_or_404(NewsletterRecipient, pk=pk)
        audit.record(
            request.user, NexusAction.Action.CONTACT_REMOVED, target_type="contacts", target_id=contact.id, label=contact.email
        )
        contact.delete()
        return Response(status=204)
