from django.conf import settings
from django.db import models

from orgs.models import Organization


class RoleType(models.TextChoices):
    FOUNDER = "founder"
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"
    VOLUNTEER = "volunteer"
    ADVISOR = "advisor", "Advisor"


class Affiliation(models.Model):
    """A person's claim of working with a real Beedero org — distinct from
    OrgMembership (platform access) and SelfDeclaredExperience (free-text,
    not linked to a real org). Founder status can only ever move to
    verified via registry-certificate review (see affiliations/services.py
    verify_founder_via_registry), never via org confirmation."""

    class Status(models.TextChoices):
        SELF_DECLARED = "self_declared"
        PENDING = "pending"
        VERIFIED = "verified"
        DISPUTED = "disputed"

    class VerifiedVia(models.TextChoices):
        ORG = "org"
        REGISTRY = "registry"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="affiliations", on_delete=models.CASCADE)
    org = models.ForeignKey(Organization, related_name="affiliations", on_delete=models.CASCADE)
    role = models.CharField(max_length=12, choices=RoleType.choices)
    title = models.CharField(max_length=120, blank=True, default="")
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.PENDING)
    verified_via = models.CharField(max_length=10, choices=VerifiedVia.choices, blank=True, default="")
    verified_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="+", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["org", "status"]), models.Index(fields=["user"])]

    def __str__(self):
        return f"{self.user_id}@{self.org_id}: {self.role} ({self.status})"
