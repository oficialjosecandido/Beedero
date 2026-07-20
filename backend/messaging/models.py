from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """A 1:1 direct-message thread. Always exactly two participants — the
    ordered pair (participant_one_id < participant_two_id, enforced by the
    constraint below) guarantees a unique row per pair regardless of who
    starts it; services.get_or_create_conversation() sorts the pair before
    lookup/creation."""

    participant_one = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="conversations_as_one", on_delete=models.CASCADE
    )
    participant_two = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="conversations_as_two", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(participant_one__lt=models.F("participant_two")),
                name="conversation_ordered_pair",
            ),
            models.UniqueConstraint(
                fields=["participant_one", "participant_two"], name="uniq_conversation_pair"
            ),
        ]

    def __str__(self):
        return f"conversation {self.pk} ({self.participant_one_id}, {self.participant_two_id})"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name="messages", on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sent_messages", on_delete=models.CASCADE)
    body = models.CharField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["conversation", "-created_at"])]

    def __str__(self):
        return f"message {self.pk} in conversation {self.conversation_id}"


class OrgConversation(models.Model):
    """A thread between an organization and an external user."""

    org = models.ForeignKey("orgs.Organization", related_name="org_conversations", on_delete=models.CASCADE)
    external_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="org_conversations_as_external", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["org", "external_user"], name="uniq_org_external_user_conversation"),
        ]

    def __str__(self):
        return f"org conversation {self.pk} ({self.org_id}, {self.external_user_id})"


class OrgMessage(models.Model):
    org_conversation = models.ForeignKey(OrgConversation, related_name="messages", on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sent_org_messages", on_delete=models.CASCADE)
    body = models.CharField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["org_conversation", "-created_at"])]

    def __str__(self):
        return f"org message {self.pk} in org conversation {self.org_conversation_id}"
