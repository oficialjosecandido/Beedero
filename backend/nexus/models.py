"""The Nexus keeps two things of its own: a record of every staff action,
and one row of platform numbers per day."""

from django.conf import settings
from django.db import models


class NexusAction(models.Model):
    """Who did what to whom, and why. Written by every Nexus action; never
    edited or deleted from the app."""

    class Action(models.TextChoices):
        USER_SUSPENDED = "user.suspended", "Suspended an account"
        USER_REACTIVATED = "user.reactivated", "Reactivated an account"
        USER_INTERNAL = "user.internal", "Changed internal flag"
        USER_VERIFIED = "user.verified", "Changed Beedero verification (person)"
        ORG_COMP = "org.comp", "Changed complimentary plan"
        ORG_FREE_EXTENDED = "org.free_extended", "Extended free period"
        ORG_VERIFIED = "org.verified", "Changed Beedero verification (organisation)"
        POST_REMOVED = "post.removed", "Removed a post"
        POST_RESTORED = "post.restored", "Restored a post"
        REPORT_RESOLVED = "report.resolved", "Resolved a report"
        NEWSLETTER_TEST = "newsletter.test", "Sent a test email"
        NEWSLETTER_SENT = "newsletter.sent", "Sent an email campaign"
        CONTACTS_ADDED = "contacts.added", "Added newsletter contacts"
        CONTACT_REMOVED = "contact.removed", "Removed a newsletter contact"
        PROMO_CREATED = "promo.created", "Created a promo code"
        PROMO_CHANGED = "promo.changed", "Changed a promo code"
        INVOICE_ISSUED = "invoice.issued", "Recorded a fatura"

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    actor_email = models.EmailField(blank=True)  # kept if the account goes
    action = models.CharField(max_length=30, choices=Action.choices, db_index=True)
    target_type = models.CharField(max_length=20, blank=True)
    target_id = models.CharField(max_length=64, blank=True, db_index=True)
    target_label = models.CharField(max_length=200, blank=True)
    reason = models.CharField(max_length=300, blank=True)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self):
        return f"{self.actor_email} {self.action} {self.target_type}:{self.target_id}"


class DailyPlatformStats(models.Model):
    """Numbers the Nexus can't read live, because the rows behind them are
    private to the people involved (row-level security): connections,
    messages, reactions, comments and all posts. The nightly `nexus_rollup`
    counts them the only way the policies allow — as each person, their own
    rows — and keeps one row per day (Lisbon time)."""

    date = models.DateField(unique=True)
    connections_total = models.PositiveIntegerField(default=0)
    connections_new = models.PositiveIntegerField(default=0)
    messages_new = models.PositiveIntegerField(default=0)
    reactions_new = models.PositiveIntegerField(default=0)
    comments_new = models.PositiveIntegerField(default=0)
    posts_new = models.PositiveIntegerField(default=0)
    # A snapshot: only known for the day the job ran, never for backfilled days.
    requests_pending = models.PositiveIntegerField(null=True, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"platform stats {self.date}"
