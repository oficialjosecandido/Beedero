from django.conf import settings
from django.db import models


class NewsletterRecipient(models.Model):
    """A contact who asked for the newsletter without (yet) having an account
    — a waitlist, an event sign-up. Their consent is why they are here, so
    `source` says where it came from, and unsubscribing keeps the row (with
    `unsubscribed_at`) so a re-import can't add them back by accident."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email


class NewsletterSend(models.Model):
    """One email campaign, from draft to sent (nexus/newsletter.py).

    Two kinds, because the law treats them differently:
      - newsletter: marketing — only people who opted in (and contacts);
      - announcement: a change to the service itself (terms, prices,
        security) — every account, no opt-in needed, used sparingly.
    """

    class Kind(models.TextChoices):
        NEWSLETTER = "newsletter", "Newsletter"
        ANNOUNCEMENT = "announcement", "Service announcement"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENDING = "sending", "Sending"
        SENT = "sent", "Sent"

    class Audience(models.TextChoices):
        # Sends made from the old /admin/newsletter page. New sends use `segment`.
        USERS = "users", "All users"
        RECIPIENTS = "recipients", "All interested contacts"
        BOTH = "both", "Both"

    subject = models.CharField(max_length=255)
    # What the author writes (a small Markdown: paragraphs, ## headings,
    # - lists, **bold**, [links](https://…)); rendered once, when queued.
    body = models.TextField(blank=True, default="")
    html_content = models.TextField(blank=True, default="")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.NEWSLETTER)
    segment = models.CharField(max_length=30, blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    audience = models.CharField(max_length=20, choices=Audience.choices, blank=True, default="")
    recipient_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)  # when the row was created
    updated_at = models.DateTimeField(auto_now=True, null=True)
    queued_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.subject} ({self.sent_at:%Y-%m-%d %H:%M})"


class NewsletterDelivery(models.Model):
    """One email to one address. Created all at once when a send is queued,
    then worked through in batches — so a send that stops half way resumes
    where it stopped and nobody gets it twice."""

    class Status(models.TextChoices):
        PENDING = "pending"
        SENT = "sent"
        FAILED = "failed"

    send = models.ForeignKey(NewsletterSend, related_name="deliveries", on_delete=models.CASCADE)
    email = models.EmailField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    contact = models.ForeignKey(NewsletterRecipient, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    error = models.CharField(max_length=300, blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["send", "email"], name="uniq_delivery_per_send")]

    def __str__(self):
        return f"{self.email} ({self.status})"
