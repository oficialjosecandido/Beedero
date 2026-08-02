import sentry_sdk
from django.conf import settings
from django.core.mail import send_mail


def notify_admin_new_user(user) -> None:
    """Email the configured admin when a new Entra user is JIT-provisioned."""
    recipient = getattr(settings, "NEW_USER_NOTIFY_EMAIL", "") or ""
    if not recipient:
        return

    email = user.email or "(no email)"
    subject = "Beedero — new user signed up"
    message = (
        "A new user was created on Beedero.\n\n"
        f"Email: {email}\n"
        f"User ID: {user.pk}\n"
        f"Username: {user.username}\n"
    )

    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [recipient])
    except Exception as exc:
        # Never block sign-up on a mail-provider hiccup.
        sentry_sdk.capture_exception(exc)
