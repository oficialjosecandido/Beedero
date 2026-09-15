from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from .notifications import notify_admin_new_user

User = get_user_model()


def get_or_provision_firebase_user(claims: dict):
    """Get-or-create the local `User` for a Firebase-authenticated request,
    keyed by the Firebase `uid` — never the email, which a user can change.

    Unlike the Entra path this replaced, it *does* link by email, once: a row
    that predates the cutover (entra_oid set, firebase_uid null) is adopted by
    the first Firebase sign-in carrying the same verified email, so existing
    profiles, orgs and connections survive the migration.

    The link is only ever made on a verified email. An unverified one would
    let anyone claim an existing account by signing up with its address.
    FirebaseIDTokenAuthentication already refuses unverified tokens before they
    reach here; this is the second lock on the same door, because this function
    is importable and the consequence of getting it wrong is account takeover.
    """
    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if not uid:
        raise AuthenticationFailed("Firebase token is missing a 'uid' claim.")
    uid = str(uid)

    user = User.objects.filter(firebase_uid=uid).first()
    if user is not None:
        return user

    email = (claims.get("email") or "").strip()
    # Firebase sets this on every email-link sign-in: clicking the link is
    # itself proof of inbox control.
    email_verified = bool(claims.get("email_verified"))

    if email and email_verified:
        # firebase_uid__isnull: never re-point a row that already belongs to
        # another Firebase identity.
        existing = User.objects.filter(
            email__iexact=email, firebase_uid__isnull=True
        ).first()
        if existing is not None:
            existing.firebase_uid = uid
            if existing.email_verified_at is None:
                existing.email_verified_at = timezone.now()
            existing.save(update_fields=["firebase_uid", "email_verified_at"])
            return existing

    try:
        with transaction.atomic():
            user = User.objects.create(
                username=f"firebase:{uid}",
                email=email,
                firebase_uid=uid,
                email_verified_at=timezone.now() if email_verified else None,
            )
    except IntegrityError:
        # Two first requests for the same brand-new uid can race here. The
        # loser re-reads the row the winner committed rather than 500ing.
        user = User.objects.filter(firebase_uid=uid).first()
        if user is None:
            raise
        return user

    notify_admin_new_user(user)
    return user
