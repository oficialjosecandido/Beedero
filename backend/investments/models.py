from django.conf import settings
from django.db import models

from orgs.models import FundraiseRound, Organization


class InvestmentRecord(models.Model):
    """A passive record of an investment closed OUTSIDE the platform.
    Doc `beedero-registo-investimento-bilateral.md` §0: this is registration,
    never intermediation — no instrument, no signature, no money handling.
    A one-sided declaration is just a claim (`declared`); it only becomes a
    verified fact once the counterparty confirms it (see
    `investments/services.py`)."""

    org = models.ForeignKey(Organization, related_name="investments_received", on_delete=models.CASCADE)
    round = models.ForeignKey(
        FundraiseRound, null=True, blank=True, related_name="investments", on_delete=models.SET_NULL
    )

    # The investor: a platform user, OR an external name (no account) — see
    # the XOR constraint below. An external investor can never move past
    # `declared`: there's no second side to confirm it.
    investor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="investments_made", on_delete=models.SET_NULL
    )
    investor_external_name = models.CharField(max_length=200, blank=True, default="")

    amount_cents = models.BigIntegerField()
    currency = models.CharField(max_length=3, default="EUR")
    invested_on = models.DateField()

    # Free text on purpose — instrument naming varies a lot in PT (SAFE,
    # convertible note, "suprimento convertível", plain equity...).
    instrument = models.CharField(max_length=40, blank=True, default="")

    class Status(models.TextChoices):
        DECLARED = "declared"
        CONFIRMED = "confirmed"
        DISPUTED = "disputed"

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DECLARED)
    declared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    declarer_side = models.CharField(max_length=10)  # "investor" | "startup"
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)

    # --- Exposure consent (doc §3) — defaults conservative, private ---
    # investor_public depends only on the investor's own intent (whichever
    # side of the exchange they were on). amount_public needs both parties
    # to agree, so it's derived (in services.confirm_investment) as the AND
    # of the two intents below — kept separately so a later confirm can
    # recompute it without losing the other side's earlier answer.
    investor_public = models.BooleanField(default=False)
    amount_public = models.BooleanField(default=False)
    declarer_amount_public_intent = models.BooleanField(default=False)
    confirmer_amount_public_intent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["org", "status"]),
            models.Index(fields=["investor_user", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(investor_user__isnull=False, investor_external_name="")
                    | (models.Q(investor_user__isnull=True) & ~models.Q(investor_external_name=""))
                ),
                name="investment_investor_user_xor_external_name",
            ),
            models.CheckConstraint(check=models.Q(amount_cents__gt=0), name="investment_amount_positive"),
        ]

    def __str__(self):
        investor_label = self.investor_user_id or self.investor_external_name
        return f"{investor_label} -> {self.org_id}: {self.amount_cents} ({self.status})"
