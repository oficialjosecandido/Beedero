"""Verification ladder — only the things somebody *other than the person*
confirmed.

Deliberately separate from accounts/completeness.py. That module is a strength
meter over self-declared fields (and feeds discovery ranking); a rung here is a
fact another party attested: the organisation, a company registry, an issuing
body, another member, or Beedero. That is why a ladder can only ever go up,
and why the weekly-post requirement lives in accounts/cadence.py instead — a
recurring duty is a streak, not a rung.

Belonging to an organisation is not required: a confirmed role is *one* route
to rung 5, and a verified professional credential reaches rung 6 without any
organisation at all.

Every rung names its attestor, including the two whose attestor is the person
themselves. Saying so out loud is the point of splitting these cards up.
"""

import math

from django.db.models import Q
from django.utils import timezone

from affiliations.models import Affiliation
from connections.models import Connection
from credibility.models import ProfessionalCredential

from .models import SelfDeclaredExperience

# A credential inside this window is still valid but worth warning about —
# renewing an expired licence is slower than renewing one that is about to
# expire, so the warning has to arrive before the date, not on it.
EXPIRY_WARNING_DAYS = 60

ATTESTED_BY_SELF = "You"


def _role_detail(affiliation) -> str:
    role = affiliation.title or affiliation.get_role_display()
    return f"{role} at {affiliation.org.name}"


def _credential_warning(credential) -> str:
    """Empty unless the licence is expired or close to it."""
    if credential.valid_until is None:
        return ""
    seconds_left = (credential.valid_until - timezone.now()).total_seconds()
    if seconds_left <= 0:
        return "This credential has expired — renew it to keep this rung."
    # Rounded up rather than truncated: a licence that runs out tomorrow
    # morning has one day left, not zero.
    days = math.ceil(seconds_left / 86_400)
    if days > EXPIRY_WARNING_DAYS:
        return ""
    unit = "day" if days == 1 else "days"
    return f"Expires in {days} {unit} — renew it to keep this rung."


def verification_ladder(profile) -> dict:
    user = profile.user

    verified_affiliation = (
        Affiliation.objects.filter(user=user, status=Affiliation.Status.VERIFIED)
        .select_related("org")
        .order_by("-verified_at")
        .first()
    )
    credential = (
        ProfessionalCredential.objects.filter(
            user=user, status=ProfessionalCredential.Status.VERIFIED
        )
        .order_by("-verified_at")
        .first()
    )
    has_record = (
        Affiliation.objects.filter(user=user).exists()
        or SelfDeclaredExperience.objects.filter(user=user).exists()
    )
    connection_count = Connection.objects.filter(Q(user_one=user) | Q(user_two=user)).count()

    rungs = [
        {
            "key": "email_confirmed",
            "label": "Email confirmed",
            "hint": "Sign in with an email link to confirm the address.",
            "done": user.is_email_verified,
            "attested_by": "Your email provider",
            "detail": user.email if user.is_email_verified else "",
            "warning": "",
        },
        {
            "key": "public_address",
            "label": "Public address claimed",
            "hint": "Claim your handle so your record has an address to point at.",
            "done": profile.has_public_handle,
            "attested_by": "Beedero",
            "detail": f"/p/{profile.handle}" if profile.handle else "",
            "warning": "",
        },
        {
            "key": "record_started",
            "label": "Record started",
            "hint": "Add one past or present role — there is nothing to confirm yet.",
            "done": has_record,
            "attested_by": ATTESTED_BY_SELF,
            "detail": "",
            "warning": "",
        },
        {
            "key": "first_connection",
            "label": "First connection accepted",
            "hint": "Connect with someone who knows your work.",
            "done": connection_count > 0,
            "attested_by": "Another member",
            "detail": (
                f"{connection_count} connection{'s' if connection_count != 1 else ''}"
                if connection_count
                else ""
            ),
            "warning": "",
        },
        {
            "key": "role_confirmed",
            "label": "Role confirmed",
            "hint": "Ask an organisation you work with to confirm your role, "
            "or prove founder status with a registry certificate.",
            "done": verified_affiliation is not None,
            "attested_by": (
                "Company registry"
                if verified_affiliation
                and verified_affiliation.verified_via == Affiliation.VerifiedVia.REGISTRY
                else "The organisation"
            ),
            "detail": _role_detail(verified_affiliation) if verified_affiliation else "",
            "warning": "",
        },
        {
            "key": "credential_verified",
            "label": "Professional credential verified",
            "hint": "Submit a licence or registration number for review. "
            "No organisation needed.",
            "done": credential is not None,
            "attested_by": credential.issuer if credential else "The issuing body",
            "detail": f"{credential.title} · {credential.identifier}" if credential else "",
            "warning": _credential_warning(credential) if credential else "",
        },
        {
            "key": "beedero_verified",
            "label": "Verified by Beedero",
            "hint": "Granted once the record above holds up to review.",
            "done": profile.is_verified,
            "attested_by": "Beedero",
            "detail": "",
            "warning": "",
        },
    ]

    # `level` is how far up you climbed without skipping: the UI says "Level 4
    # of 7", which is a different (and more honest) number than done_count
    # when someone is verified by Beedero but never claimed a handle.
    level = 0
    for rung in rungs:
        if not rung["done"]:
            break
        level += 1

    return {
        "rungs": rungs,
        "done_count": sum(1 for rung in rungs if rung["done"]),
        "total_count": len(rungs),
        "level": level,
    }
