"""Verification lifecycle (doc §7): submit -> manual review (approve/reject)
-> expire (see management command). One flow for every VerificationType;
level-specific behaviour (NIF validation, derived financial fields) lives in
small hooks called from here rather than separate services per rung.
"""

from datetime import datetime, timedelta

import sentry_sdk
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from orgs.constants import SectionKind
from orgs.models import OrgField, OrgMembership, OrgSection, Visibility

from .models import Verification, VerificationType
from .nif import nif_is_valid
from .storage import upload_private_document

# valid_until policy (doc §5). Tax/SS clearance aren't here — their validity
# is printed on the certificate itself and read from payload at approval time.
_ANNUAL_VALIDITY = {
    VerificationType.COMPANY_REGISTRY: timedelta(days=365),
    VerificationType.FOUNDER_ROLE: timedelta(days=365),
}

FINANCIAL_FIELD_KEYS = ("revenue_fy", "net_income_fy", "equity_fy", "fiscal_year")


def submit_verification(org, user, type_: str, payload: dict, files: dict) -> Verification:
    """Reuses an existing PENDING row for a resubmission (so re-editing
    before review doesn't spam the queue with duplicates); a verification
    that was already VERIFIED/REJECTED/EXPIRED always starts a fresh row,
    so review history for the org is never overwritten."""
    if type_ == VerificationType.COMPANY_REGISTRY and not nif_is_valid(payload.get("nif", "")):
        raise ValidationError("Invalid NIF.")

    document_refs = [
        {"field": field_name, "blob": upload_private_document(file, org_slug=org.slug)}
        for field_name, file in files.items()
    ]

    pending = Verification.objects.filter(org=org, type=type_, status=Verification.Status.PENDING).first()
    if pending:
        pending.payload = payload
        if document_refs:
            pending.document_refs = document_refs
        pending.submitted_by = user
        pending.save()
        return pending

    return Verification.objects.create(
        org=org, type=type_, payload=payload, document_refs=document_refs, submitted_by=user
    )


def _valid_until_for(verification: Verification):
    type_ = verification.type
    if type_ in _ANNUAL_VALIDITY:
        return timezone.now() + _ANNUAL_VALIDITY[type_]
    if type_ in (VerificationType.TAX_CLEARANCE, VerificationType.SS_CLEARANCE):
        raw = verification.payload.get("valid_until")
        return parse_datetime(raw) if raw else None
    if type_ == VerificationType.ANNUAL_ACCOUNTS:
        try:
            year = int(verification.payload.get("fiscal_year"))
        except (TypeError, ValueError):
            return None
        # Doc §3: normal approval+filing window closes 30 Sep of the
        # following year.
        return timezone.make_aware(datetime(year + 1, 9, 30))
    return None


def _write_financial_fields(org, verification: Verification):
    section, _ = OrgSection.objects.get_or_create(
        org=org,
        kind=SectionKind.CERTIFIED_FINANCIALS,
        defaults={"visibility": Visibility.RESTRICTED},
    )
    for key in FINANCIAL_FIELD_KEYS:
        value = verification.payload.get(key)
        if value is None:
            continue
        field, created = OrgField.objects.get_or_create(
            section=section, key=key, defaults={"value": value, "visibility": Visibility.RESTRICTED}
        )
        if not created:
            field.value = value
            field.save(update_fields=["value"])


def notify_org_owners(org, message: str):
    emails = list(
        OrgMembership.objects.filter(org=org, role=OrgMembership.Role.OWNER).values_list(
            "user__email", flat=True
        )
    )
    if not emails:
        return
    try:
        send_mail(f"Beedero — {org.name} verification update", message, settings.DEFAULT_FROM_EMAIL, emails)
    except Exception as exc:
        # Same rule as accounts._send_verification_email (P2.4): never let a
        # mail-provider hiccup fail the review action itself, but never swallow
        # it silently either.
        sentry_sdk.capture_exception(exc)


@transaction.atomic
def approve_verification(verification: Verification, reviewer) -> Verification:
    """Idempotent: no-ops once the row has left PENDING, so re-running the
    admin action on an already-decided row is harmless."""
    if verification.status != Verification.Status.PENDING:
        return verification

    from .levels import credibility_level

    level_before = credibility_level(verification.org)

    verification.status = Verification.Status.VERIFIED
    verification.reviewed_by = reviewer
    verification.reviewed_at = timezone.now()
    verification.valid_until = _valid_until_for(verification)
    verification.save()

    if verification.type == VerificationType.ANNUAL_ACCOUNTS:
        _write_financial_fields(verification.org, verification)

    notify_org_owners(
        verification.org, f"Your '{verification.get_type_display()}' verification was approved."
    )
    from notifications.milestones import check_credibility_level_milestone
    from notifications.services import notify_verification_update

    notify_verification_update(
        verification.org, f"Your '{verification.get_type_display()}' verification was approved."
    )
    check_credibility_level_milestone(verification.org, level_before, credibility_level(verification.org))
    return verification


def reject_verification(verification: Verification, reviewer, reason: str) -> Verification:
    if verification.status != Verification.Status.PENDING:
        return verification
    verification.status = Verification.Status.REJECTED
    verification.reviewed_by = reviewer
    verification.reviewed_at = timezone.now()
    verification.rejection_reason = reason
    verification.save()
    notify_org_owners(
        verification.org,
        f"Your '{verification.get_type_display()}' verification was rejected: {reason}",
    )
    from notifications.services import notify_verification_update

    notify_verification_update(
        verification.org,
        f"Your '{verification.get_type_display()}' verification was rejected: {reason}",
    )
    return verification
