"""Web push via Firebase Cloud Messaging. Optional: with no service account
configured, send_push() is a silent no-op — push is a progressive
enhancement layered on top of in-app notifications, not core infra like
email (see beedero/settings.py)."""

import sentry_sdk

from beedero.firebase import get_firebase_app


def send_push(user, *, title: str, body: str, link: str = ""):
    # Shared with accounts.firebase_auth — firebase_admin allows only one
    # initialize_app() per app name, so both go through beedero.firebase.
    app = get_firebase_app()
    if app is None:
        return

    from .models import PushSubscription

    tokens = list(PushSubscription.objects.filter(user=user).values_list("token", flat=True))
    if not tokens:
        return

    from firebase_admin import messaging

    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=link) if link else None,
            notification=messaging.WebpushNotification(
                icon="/icons/icon-192.png",
            ),
        ),
    )

    try:
        response = messaging.send_each_for_multicast(message)
    except Exception:
        sentry_sdk.capture_exception()
        return

    if not response.failure_count:
        return

    stale_tokens = []
    for token, result in zip(tokens, response.responses):
        if result.success:
            continue
        code = getattr(result.exception, "code", "")
        if code in ("NOT_FOUND", "UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"):
            stale_tokens.append(token)

    if stale_tokens:
        PushSubscription.objects.filter(token__in=stale_tokens).delete()
