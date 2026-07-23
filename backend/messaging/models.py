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


class UserBlock(models.Model):
    """A directed block: `blocker` no longer wants contact from `blocked`.
    services.is_blocked() checks both directions, so once either side blocks
    the other, neither can start a new conversation or send a message —
    RLS below mirrors Conversation's own policy (visible to both parties,
    not just the blocker) so that direction check can actually see the row
    regardless of which side is querying."""

    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="blocks_made", on_delete=models.CASCADE)
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="blocks_received", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="uniq_user_block"),
            models.CheckConstraint(check=~models.Q(blocker=models.F("blocked")), name="block_not_self"),
        ]

    def __str__(self):
        return f"{self.blocker_id} blocks {self.blocked_id}"


class MessageReport(models.Model):
    """A user flagging another for abuse/unsolicited contact within a DM
    thread. Reviewed only via /admin (like credibility.Verification) —
    never read back through a public API, so unlike UserBlock this has no
    RLS policy: a `beedero_app`-role admin session runs with
    beedero.viewer_id=0 (no JWT on session-authenticated /admin/ requests,
    see orgs.middleware._viewer_id), which would hide every row from staff
    if FORCE ROW LEVEL SECURITY applied here."""

    class Reason(models.TextChoices):
        UNSOLICITED = "unsolicited", "Unwanted contact"
        HARASSMENT = "harassment", "Harassment or abuse"
        SCAM = "scam", "Scam or fraud"
        OTHER = "other", "Other"

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reports_filed", on_delete=models.CASCADE)
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="reports_against", on_delete=models.CASCADE
    )
    conversation = models.ForeignKey(Conversation, related_name="reports", on_delete=models.CASCADE)
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.CharField(max_length=1000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"report {self.pk}: {self.reporter_id} -> {self.reported_user_id} ({self.reason})"
