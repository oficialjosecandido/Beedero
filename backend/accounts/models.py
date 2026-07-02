from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # investor, founder, talent (future)
    pass


class InvestorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)  # verification badge
    verified_at = models.DateTimeField(null=True, blank=True)
    # JSONField instead of ArrayField (Postgres-only) for SQLite/Postgres portability.
    stage_focus = models.JSONField(default=list, blank=True)
    sector_focus = models.JSONField(default=list, blank=True)
    geo_focus = models.JSONField(default=list, blank=True)
    check_min = models.PositiveIntegerField(null=True, blank=True)
    check_max = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"InvestorProfile({self.user.username})"
