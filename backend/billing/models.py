from django.conf import settings
from django.db import models

from orgs.models import Organization


class Subscription(models.Model):
    """Freemium doc §1/§6. Subject is either an org (Founder Pro) or, much
    later, an investor user — never both, hence the two nullable FKs instead
    of a generic subject reference (simpler joins, and the two subject types
    will likely diverge in fields long before this needs to be generic)."""

    class Plan(models.TextChoices):
        FREE = "free"
        FOUNDER_PRO = "founder_pro"

    class Status(models.TextChoices):
        ACTIVE = "active"
        CANCELED = "canceled"
        PAST_DUE = "past_due"

    org = models.ForeignKey(
        Organization, null=True, blank=True, related_name="subscriptions", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="subscriptions", on_delete=models.CASCADE
    )
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    provider_ref = models.CharField(max_length=100, blank=True)  # Stripe subscription id
    current_period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(org__isnull=False) | models.Q(user__isnull=False),
                name="subscription_has_a_subject",
            )
        ]

    def __str__(self):
        subject = self.org.slug if self.org_id else self.user_id
        return f"{subject} — {self.plan} ({self.status})"


class StripeCustomer(models.Model):
    """Lazily created (doc §6) — one row per org, whether or not it has ever
    subscribed to anything. Created on org creation or first upgrade attempt
    so there's nothing to backfill on the day a paid plan actually launches."""

    org = models.OneToOneField(Organization, related_name="stripe_customer", on_delete=models.CASCADE)
    provider_ref = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.org.slug} -> {self.provider_ref}"


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
