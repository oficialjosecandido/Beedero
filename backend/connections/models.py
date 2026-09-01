from django.conf import settings
from django.db import models


class ConnectionRequest(models.Model):
    """First contact between two people — always a request with an optional
    note, never an open conversation. Accepting one creates the Connection
    and opens a direct-message thread (with the note as the first message
    when one was included); see connections.services.accept_request."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        IGNORED = "ignored", "Ignored"

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="connection_requests_sent", on_delete=models.CASCADE
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="connection_requests_received", on_delete=models.CASCADE
    )
    note = models.CharField(max_length=300, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["requester", "recipient"],
                condition=models.Q(status="pending"),
                name="uniq_pending_connection_request",
            ),
            models.CheckConstraint(
                check=~models.Q(requester=models.F("recipient")), name="connection_request_not_self"
            ),
        ]

    def __str__(self):
        return f"connection request {self.pk}: {self.requester_id} -> {self.recipient_id} ({self.status})"


class Connection(models.Model):
    """An established connection between two people. Mirrors
    messaging.Conversation's ordered-pair pattern: user_one_id < user_two_id
    is always enforced, so services sort the pair before lookup/creation."""

    user_one = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="connections_as_one", on_delete=models.CASCADE
    )
    user_two = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="connections_as_two", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(user_one__lt=models.F("user_two")), name="connection_ordered_pair"
            ),
            models.UniqueConstraint(fields=["user_one", "user_two"], name="uniq_connection_pair"),
        ]

    def __str__(self):
        return f"connection {self.pk} ({self.user_one_id}, {self.user_two_id})"


class OrgConnectionRequest(models.Model):
    """A connection request between a person and an org — either the person
    reaching out to the org, or an org admin reaching out to the person
    (spec §6). initiated_by tracks direction; created_by is always the
    acting user (the requester themself, or the admin acting for the org)."""

    class InitiatedBy(models.TextChoices):
        USER = "user", "Person"
        ORG = "org", "Organization"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        IGNORED = "ignored", "Ignored"

    org = models.ForeignKey("orgs.Organization", related_name="connection_requests", on_delete=models.CASCADE)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="org_connection_requests", on_delete=models.CASCADE
    )
    initiated_by = models.CharField(max_length=10, choices=InitiatedBy.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="org_connection_requests_created", on_delete=models.CASCADE
    )
    note = models.CharField(max_length=300, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["org", "requester"],
                condition=models.Q(status="pending"),
                name="uniq_pending_org_connection_request",
            ),
        ]

    def __str__(self):
        return f"org connection request {self.pk}: {self.org_id} <-> {self.requester_id} ({self.status})"
