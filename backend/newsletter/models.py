from django.conf import settings
from django.db import models


class NewsletterRecipient(models.Model):
    """Admin-curated email address that isn't necessarily a registered User."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email


class NewsletterSend(models.Model):
    """Audit row for one newsletter campaign send."""

    class Audience(models.TextChoices):
        USERS = "users", "Todos os utilizadores"
        RECIPIENTS = "recipients", "Todos os interessados"
        BOTH = "both", "Ambos"

    subject = models.CharField(max_length=255)
    html_content = models.TextField()
    audience = models.CharField(max_length=20, choices=Audience.choices)
    recipient_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.subject} ({self.sent_at:%Y-%m-%d %H:%M})"
