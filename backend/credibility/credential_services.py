"""ProfessionalCredential lifecycle — submit -> manual review (approve/reject).
Sibling to services.py's Verification flow, kept separate since credentials
are person-scoped rather than org-scoped (see models.ProfessionalCredential).
"""

from django.conf import settings
from django.utils import timezone
from notifications.models import Notification
from notifications.services import notify

from .models import ProfessionalCredential
from .storage import upload_private_credential_document


def submit_credential(user, *, title: str, issuer: str, identifier: str, file=None) -> ProfessionalCredential:
    """Reuses an existing PENDING row for the same (user, title, issuer,
    identifier) so re-editing before review doesn't spam the queue —
    same convention as services.submit_verification."""
    document_refs = (
        [{"field": "credential_document", "blob": upload_private_credential_document(file, user_id=user.id)}]
        if file
        else []
    )

    pending = ProfessionalCredential.objects.filter(
        user=user,
        title=title,
        issuer=issuer,
        identifier=identifier,
        status=ProfessionalCredential.Status.PENDING,
    ).first()
    if pending:
        if document_refs:
            pending.document_refs = document_refs
            pending.save(update_fields=["document_refs"])
        return pending

    return ProfessionalCredential.objects.create(
        user=user, title=title, issuer=issuer, identifier=identifier, document_refs=document_refs
    )


def _notify(credential: ProfessionalCredential, message: str):
    notify(
        credential.user,
        kind=Notification.Kind.VERIFICATION,
        aggregate_key=f"credential:{credential.id}",
        title="Professional credential update",
        body=message,
        link="/dashboard?tab=settings",
    )


def approve_credential(credential: ProfessionalCredential, reviewer) -> ProfessionalCredential:
    """Idempotent, mirrors services.approve_verification."""
    if credential.status != ProfessionalCredential.Status.PENDING:
        return credential

    credential.status = ProfessionalCredential.Status.VERIFIED
    credential.reviewed_by = reviewer
    credential.reviewed_at = timezone.now()
    credential.verified_at = timezone.now()
    credential.save()

    _notify(credential, f"Your '{credential.title}' credential was verified.")
    return credential


def reject_credential(credential: ProfessionalCredential, reviewer, reason: str) -> ProfessionalCredential:
    if credential.status != ProfessionalCredential.Status.PENDING:
        return credential

    credential.status = ProfessionalCredential.Status.REJECTED
    credential.reviewed_by = reviewer
    credential.reviewed_at = timezone.now()
    credential.rejection_reason = reason
    credential.save()

    _notify(credential, f"Your '{credential.title}' credential was rejected: {reason}")
    return credential


def verified_credentials_payload(user) -> list[dict]:
    """Dossiê data — always states exactly what was verified (doc's explicit
    anti-vagueness requirement), never a bare trust label."""
    credentials = ProfessionalCredential.objects.filter(
        user=user, status=ProfessionalCredential.Status.VERIFIED
    ).order_by("-verified_at")
    return [
        {
            "title": c.title,
            "issuer": c.issuer,
            "identifier": c.identifier,
            "verified_at": c.verified_at.date().isoformat() if c.verified_at else None,
        }
        for c in credentials
    ]
