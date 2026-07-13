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
