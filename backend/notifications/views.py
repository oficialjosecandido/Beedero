from django.core import signing
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DigestSend, Notification, NotificationPreference

# 1x1 transparent GIF, served by the open-tracking pixel.
_TRANSPARENT_GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
    b"\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)

DIGEST_UNSUB_SALT = "notifications.digest.unsubscribe"
DIGEST_PIXEL_SALT = "notifications.digest.pixel"


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by("-updated_at", "-id")[:50]
        unread = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response(
            {
                "unread_count": unread,
                "items": [
                    {
                        "id": n.id,
                        "kind": n.kind,
                        "title": n.title,
                        "body": n.body,
                        "link": n.link,
                        "payload": n.payload,
                        "read": n.read_at is not None,
                        "created_at": n.created_at.isoformat(),
                        "updated_at": n.updated_at.isoformat(),
                    }
                    for n in notifications
                ],
            }
        )


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids")
        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
        if ids:
            qs = qs.filter(id__in=ids)

        updated = qs.update(read_at=timezone.now())
        unread = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"marked": updated, "unread_count": unread})


class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unread = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"unread_count": unread})


class NotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response({"digest_email": pref.digest_email, "inapp_engagement": pref.inapp_engagement})

    def patch(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        fields = []
        for field in ("digest_email", "inapp_engagement"):
            if field in request.data:
                setattr(pref, field, bool(request.data[field]))
                fields.append(field)
        if fields:
            pref.save(update_fields=fields)
        return Response({"digest_email": pref.digest_email, "inapp_engagement": pref.inapp_engagement})


def digest_unsubscribe_token(user_id: int) -> str:
    return signing.dumps(user_id, salt=DIGEST_UNSUB_SALT)


def digest_pixel_token(send_id: int) -> str:
    return signing.dumps(send_id, salt=DIGEST_PIXEL_SALT)


class DigestUnsubscribeView(APIView):
    """GET, no auth — clicked straight from the email. One-click unsubscribe
    per doc §4; the signed token is the only credential, same pattern as
    email-verification links."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        try:
            user_id = signing.loads(token, salt=DIGEST_UNSUB_SALT, max_age=60 * 60 * 24 * 30)
        except signing.BadSignature:
            return Response({"detail": "Invalid or expired link."}, status=400)
        pref, _ = NotificationPreference.objects.get_or_create(user_id=user_id)
        pref.digest_email = False
        pref.save(update_fields=["digest_email"])
        return Response({"detail": "You have been unsubscribed from the weekly digest."})


class DigestPixelView(APIView):
    """GET, no auth — 1x1 gif embedded in the digest email body for open tracking."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        try:
            send_id = signing.loads(token, salt=DIGEST_PIXEL_SALT, max_age=60 * 60 * 24 * 30)
        except signing.BadSignature:
            send_id = None
        if send_id is not None:
            DigestSend.objects.filter(id=send_id, opened_at__isnull=True).update(opened_at=timezone.now())
        return HttpResponse(_TRANSPARENT_GIF, content_type="image/gif")
