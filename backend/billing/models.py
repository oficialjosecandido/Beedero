from django.conf import settings
from django.db import models

from orgs.models import Organization


class Subscription(models.Model):
    """One row per subscription an organisation has had (or a user, for the
    dormant investor plans). The current one is the latest row that grants
    access — see billing/access.py.

    Two kinds of rows, told apart by `provider_ref`:

    - **Stripe-backed** (`provider_ref` = Stripe subscription id): created
      and kept in step by checkout and the Stripe webhook. `status` mirrors
      Stripe's own status.
    - **Local free period** (`provider_ref` empty): the free year from a code
      such as EARLYADOPTER, or the launch year every existing organisation
      got. No card and nothing in Stripe; `trial_end` is when it ends. When
      the organisation pays, the Stripe subscription takes over and this row
      is closed (`status` canceled).
    """

    class Plan(models.TextChoices):
        FREE = "free"  # legacy, never grants access
        FOUNDER_PRO = "founder_pro"  # legacy, dormant
        ORG_YEARLY = "org_yearly", "Yearly"
        ORG_MONTHLY = "org_monthly", "Monthly"
        COMP = "comp", "Complimentary"

    class Status(models.TextChoices):
        # Stripe's subscription statuses, verbatim.
        TRIALING = "trialing"
        ACTIVE = "active"
        PAST_DUE = "past_due"
        PAUSED = "paused"
        CANCELED = "canceled"
        UNPAID = "unpaid"
        INCOMPLETE = "incomplete"
        INCOMPLETE_EXPIRED = "incomplete_expired"

    class Source(models.TextChoices):
        CHECKOUT = "checkout"
        PROMO = "promo"
        LAUNCH = "launch"
        ADMIN = "admin"

    org = models.ForeignKey(
        Organization, null=True, blank=True, related_name="subscriptions", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="subscriptions", on_delete=models.CASCADE
    )
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.CHECKOUT)
    provider_ref = models.CharField(max_length=100, blank=True, db_index=True)  # Stripe subscription id
    promo_code = models.ForeignKey(
        "PromoCode", null=True, blank=True, related_name="subscriptions", on_delete=models.PROTECT
    )
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(org__isnull=False) | models.Q(user__isnull=False),
                name="subscription_has_a_subject",
            ),
            # One free year per organisation, whichever way it came.
            models.UniqueConstraint(
                fields=["org"],
                condition=models.Q(source__in=["promo", "launch"]),
                name="one_free_period_per_org",
            ),
        ]
        indexes = [models.Index(fields=["org", "status"])]

    def __str__(self):
        subject = self.org.slug if self.org_id else self.user_id
        return f"{subject} — {self.plan} ({self.status})"


class PromoCode(models.Model):
    """A code typed on the onboarding page. Today the only kind is a free
    period (`free_days`, 365 for EARLYADOPTER): no card, nothing in Stripe.
    Codes are stored upper-case and matched case-insensitively."""

    code = models.CharField(max_length=40, unique=True)
    free_days = models.PositiveIntegerField(default=365)
    active = models.BooleanField(default=True)
    max_redemptions = models.PositiveIntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class BillingAgreement(models.Model):
    """The moment someone accepted the subscription terms for an organisation:
    which version, which plan, who. Kept even if the organisation never pays."""

    org = models.ForeignKey(Organization, related_name="billing_agreements", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True)
    terms_version = models.CharField(max_length=20)
    plan = models.CharField(max_length=20, choices=Subscription.Plan.choices)
    accepted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.org.slug} accepted {self.terms_version}"


class StripeEvent(models.Model):
    """Every webhook event handled, by id — Stripe retries, and an event
    applied twice must change nothing the second time."""

    event_id = models.CharField(max_length=100, unique=True)
    type = models.CharField(max_length=100)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} {self.event_id}"


class PaidInvoice(models.Model):
    """A Stripe invoice that was paid. Stripe's invoice is not a Portuguese
    fatura (it does not come from certified invoicing software), so each row
    here is one fatura-recibo to issue — `fatura_reference` records it."""

    # SET_NULL, not CASCADE: an invoicing record has to be kept whether or not
    # the company that paid still has an account here, which is why the
    # customer's name and tax id are copied in rather than read off the org.
    org = models.ForeignKey(
        Organization, related_name="paid_invoices", on_delete=models.SET_NULL, null=True
    )
    stripe_invoice_id = models.CharField(max_length=100, unique=True)
    number = models.CharField(max_length=60, blank=True)
    amount_paid_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="eur")
    customer_name = models.CharField(max_length=200, blank=True)
    customer_tax_ids = models.CharField(max_length=200, blank=True)
    hosted_invoice_url = models.URLField(max_length=500, blank=True)
    paid_at = models.DateTimeField()
    fatura_reference = models.CharField(max_length=60, blank=True)
    fatura_issued_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-paid_at"]

    def __str__(self):
        return f"{self.number or self.stripe_invoice_id} ({self.amount_paid_cents / 100:.2f} {self.currency})"


class StripeCustomer(models.Model):
    """One row per org that has ever been sent to Stripe. Created on the first
    checkout, never for organisations on a free period."""

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
