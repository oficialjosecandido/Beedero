from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.fields.json import KeyTextTransform

from orgs.models import Organization


class VerificationType(models.TextChoices):
    # Nivel 1
    COMPANY_REGISTRY = "company_registry"
    FOUNDER_ROLE = "founder_role"
    # Nivel 2
    TAX_CLEARANCE = "tax_clearance"
    SS_CLEARANCE = "ss_clearance"
    # Nivel 3
    ANNUAL_ACCOUNTS = "annual_accounts"
    # Nivel 4
    STRIPE_TRACTION = "stripe_traction"
    OPEN_BANKING = "open_banking"
    SAFT_EFATURA = "saft_efatura"


class Verification(models.Model):
    """Generic verification record — one flow (submit/review/expire) shared
    by every ladder rung instead of a model per document type."""

    class Status(models.TextChoices):
        PENDING = "pending"
        VERIFIED = "verified"
        REJECTED = "rejected"
        EXPIRED = "expired"

    org = models.ForeignKey(Organization, related_name="verifications", on_delete=models.CASCADE)
    type = models.CharField(max_length=30, choices=VerificationType.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    # Submitted data (registry access code, NIF, OCC number, ...) — never the
    # document itself. Attached files go to private blob storage (storage.py);
    # only their blob references live here.
    payload = models.JSONField(default=dict, blank=True)
    document_refs = models.JSONField(default=list, blank=True)

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="credibility_reviews",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    valid_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["org", "type", "status"])]
        constraints = [
            # At most one VERIFIED verification per (org, type).
            models.UniqueConstraint(
                fields=["org", "type"],
                condition=Q(status="verified"),
                name="uniq_verified_per_org_type",
            ),
            # Anti-abuse (doc §2): the same NIF can't be the verified identity
            # of more than one org — stops the "same company, competing
            # profiles" duplication attack. Expression index on the JSON
            # payload rather than a dedicated column, since `payload` is
            # shared across every verification type.
            models.UniqueConstraint(
                KeyTextTransform("nif", "payload"),
                condition=Q(status="verified", type=VerificationType.COMPANY_REGISTRY),
                name="uniq_verified_nif_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.org.slug} {self.type} ({self.status})"


class ProfessionalCredential(models.Model):
    """Professional credential for non-startup professionals & micro-businesses
    (e.g. a psychotherapist's licence confirmed with a professional order) —
    a credibility layer, not a new product (doc "Credibilidade para
    Profissionais & Negócios não-startup"). A deliberate sibling to
    `Verification` rather than a change to it: `Verification.org` is a
    non-nullable FK to `Organization`, and credentials here are person-scoped.

    Badge/UI copy built from this must always state exactly what was
    verified (issuer, identifier, verified date) — never vague trust
    language like "trusted professional".
    """

    class Status(models.TextChoices):
        PENDING = "pending"
        VERIFIED = "verified"
        REJECTED = "rejected"
        EXPIRED = "expired"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="professional_credentials", on_delete=models.CASCADE
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    title = models.CharField(max_length=120)  # e.g. "Psychotherapist"
    issuer = models.CharField(max_length=200)  # e.g. "Ordem dos Psicólogos"
    identifier = models.CharField(max_length=100)  # e.g. licence/cédula number

    # Same private-blob-reference convention as Verification.document_refs —
    # the document itself never touches this row.
    document_refs = models.JSONField(default=list, blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="credential_reviews",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "status"])]
        constraints = [
            # Anti-abuse, same shape as Verification's NIF constraint: the
            # same licence number at the same issuer can't be the verified
            # credential of more than one user.
            models.UniqueConstraint(
                fields=["issuer", "identifier"],
                condition=Q(status="verified"),
                name="uniq_verified_credential_per_issuer_identifier",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} {self.title} ({self.status})"
