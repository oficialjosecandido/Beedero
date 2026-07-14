import uuid

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


def get_or_provision_user(claims: dict):
    """Get-or-create the local shadow `User` for an Entra-authenticated
    request, keyed by the stable `oid` claim — never the email, which Entra
    lets a user change independently. No account-linking to pre-existing
    native accounts: every new `oid` gets a fresh row. This is a deliberate
    simplification of doc §2.2's email-linking design, made possible because
    the native user base was cleared ahead of the Entra cutover."""
    oid = claims.get("oid") or claims.get("sub")
    if not oid:
        raise AuthenticationFailed("Entra token is missing an 'oid' claim.")

    entra_oid = uuid.UUID(str(oid))
    user = User.objects.filter(entra_oid=entra_oid).first()
    if user is not None:
        return user

    email = claims.get("email") or claims.get("preferred_username") or ""
    return User.objects.create(
        username=f"entra:{entra_oid}",
        email=email,
        entra_oid=entra_oid,
        # Entra's sign-up flow verifies the email via OTP before issuing a
        # token, so a token bearing an email implies it's already verified.
        email_verified_at=timezone.now() if email else None,
    )
