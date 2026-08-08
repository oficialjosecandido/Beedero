from django.conf import settings
from django.db import models


class AdvisorProfile(models.Model):
    """Self-declared advisory/board preferences. Verified track record lives
    on `orgs.OrgMembership` (role in ADVISOR/BOARD/FRACTIONAL) — that's a
    real org-confirmed affiliation, not something declared here."""

    class Engagement(models.TextChoices):
        ADVISORY = "advisory", "Advisory"
        BOARD = "board", "Board"
        FRACTIONAL = "fractional", "Fractional"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_available = models.BooleanField(default=False)
    # JSONField instead of ArrayField (Postgres-only) for SQLite/Postgres portability.
    expertise = models.JSONField(default=list, blank=True)
    stages = models.JSONField(default=list, blank=True)
    sectors = models.JSONField(default=list, blank=True)
    engagement_types = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AdvisorProfile({self.user_id})"
