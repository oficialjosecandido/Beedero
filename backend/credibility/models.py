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
