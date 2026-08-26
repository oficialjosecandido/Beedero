import hashlib

from django.conf import settings
from django.db import models


class Reaction(models.Model):
    class Kind(models.TextChoices):
        LIKE = "like"  # 👍
        INSIGHT = "insight"  # 💡
        CONGRATS = "congrats"  # 🎉

    activity = models.ForeignKey("orgs.Activity", related_name="reactions", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reactions", on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.LIKE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["activity", "user"], name="uniq_reaction_per_user_per_activity")
        ]

    def __str__(self):
        return f"{self.user_id} {self.kind} on activity {self.activity_id}"


class EventParticipation(models.Model):
    """RSVP to an event activity — distinct from reactions."""

    class Status(models.TextChoices):
        GOING = "going"

    activity = models.ForeignKey(
        "orgs.Activity", related_name="participations", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="event_participations", on_delete=models.CASCADE
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.GOING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "user"], name="uniq_event_participation_per_user"
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.status} on activity {self.activity_id}"


class Comment(models.Model):
    activity = models.ForeignKey("orgs.Activity", related_name="comments", on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="comments", on_delete=models.CASCADE)
    body = models.CharField(max_length=2000)
    # One level deep only: a reply's parent must itself have no parent
    # (enforced in the view, not here — a DB constraint on self-FK depth
    # needs a trigger, and the view already has to load parent anyway).
    parent = models.ForeignKey(
        "self", null=True, blank=True, related_name="replies", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["activity", "-created_at"])]

    def __str__(self):
        return f"comment {self.id} on activity {self.activity_id}"


class LinkPreview(models.Model):
    """Unfurled OG metadata for a URL found in a post/comment body, fetched
    via a third-party service (social/unfurl.py) rather than Beedero's own
    server — keeps the SSRF surface off our infrastructure. Cached by
    url_hash so the same link across many posts is only ever fetched once."""

    class Status(models.TextChoices):
        PENDING = "pending"
        READY = "ready"
        FAILED = "failed"

    url = models.URLField(max_length=2000)
    url_hash = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    title = models.CharField(max_length=300, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")
    image_url = models.URLField(max_length=2000, blank=True, default="")
    site_name = models.CharField(max_length=200, blank=True, default="")
    fetched_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash_for(url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()

    def __str__(self):
        return self.url


class Mention(models.Model):
    """A resolved `@[user:<handle>]` / `@[org:<slug>]` marker found in an
    Activity or Comment body at save time (social/mentions.py). Kept as its
    own row (rather than re-parsing the body on every read) so notification
    fan-out and future "who mentioned me" views don't need to re-resolve
    handles/slugs that may since have changed or been freed."""

    activity = models.ForeignKey(
        "orgs.Activity", null=True, blank=True, related_name="mentions", on_delete=models.CASCADE
    )
    comment = models.ForeignKey(
        Comment, null=True, blank=True, related_name="mentions", on_delete=models.CASCADE
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="mentions_made", on_delete=models.CASCADE
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="mentions_received", on_delete=models.CASCADE
    )
    target_org = models.ForeignKey(
        "orgs.Organization", null=True, blank=True, related_name="mentions_received", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(activity__isnull=False, comment__isnull=True)
                    | models.Q(activity__isnull=True, comment__isnull=False)
                ),
                name="mention_belongs_to_exactly_one_container",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(target_user__isnull=False, target_org__isnull=True)
                    | models.Q(target_user__isnull=True, target_org__isnull=False)
                ),
                name="mention_targets_exactly_one_kind",
            ),
        ]
        indexes = [
            models.Index(fields=["target_user", "-created_at"]),
            models.Index(fields=["target_org", "-created_at"]),
        ]

    def __str__(self):
        target = self.target_user_id or self.target_org_id
        container = f"activity {self.activity_id}" if self.activity_id else f"comment {self.comment_id}"
        return f"mention of {target} in {container}"
