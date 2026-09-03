"""Web push via Firebase Cloud Messaging. Optional: with no service account
configured, send_push() is a silent no-op — push is a progressive
enhancement layered on top of in-app notifications, not core infra like
email (see beedero/settings.py)."""

import json

import sentry_sdk
from django.conf import settings

_app = None
_init_attempted = False


def _get_app():
    global _app, _init_attempted
    if _init_attempted:
        return _app
    _init_attempted = True

    if not settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        return None

    import firebase_admin
    from firebase_admin import credentials

    cred = credentials.Certificate(json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON))
    _app = firebase_admin.initialize_app(cred)
    return _app


def send_push(user, *, title: str, body: str, link: str = ""):
    app = _get_app()
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
