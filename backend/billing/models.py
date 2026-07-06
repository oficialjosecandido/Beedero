from django.db import models

from orgs.models import Organization


class CommitmentFee(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        PAID = "paid"
        REFUNDED = "refunded"

    org = models.OneToOneField(Organization, related_name="commitment_fee", on_delete=models.CASCADE)
    amount_cents = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    provider_ref = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.org.slug} fee ({self.status})"


class OrgCredit(models.Model):
    org = models.ForeignKey(Organization, related_name="credits", on_delete=models.CASCADE)
    amount_cents = models.IntegerField()
    reason = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.org.slug} credit {self.amount_cents} ({self.reason})"
