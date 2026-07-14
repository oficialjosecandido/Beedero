"""In-app notifications — single emitter for engagement events."""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        REACTION = "reaction"
        COMMENT = "comment"
        FOLLOWER = "follower"
        INTEREST = "interest"
        VERIFICATION = "verification"
        PROFILE_VIEWS = "profile_views"
        MILESTONE = "milestone"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="notifications", on_delete=models.CASCADE
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    aggregate_key = models.CharField(max_length=120, db_index=True)
    title = models.CharField(max_length=200)
    body = models.TextField()
    link = models.CharField(max_length=300, blank=True, default="")
    # Milestone-only: a suggested post the user can copy into the composer
    # and publish manually — never auto-published (doc §5).
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}: {self.title}"


class NotificationPreference(models.Model):
    """Two booleans (doc §2) — no per-type matrix in the MVP."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="notification_preference", on_delete=models.CASCADE
    )
    digest_email = models.BooleanField(default=True)
    inapp_engagement = models.BooleanField(default=True)

    def __str__(self):
        return f"prefs for {self.user_id}"


class DigestSend(models.Model):
    """One row per weekly digest email sent — backs the open-tracking pixel."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="digest_sends", on_delete=models.CASCADE)
    sent_at = models.DateTimeField(auto_now_add=True)
    opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-sent_at"])]
