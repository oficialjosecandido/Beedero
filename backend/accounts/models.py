from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # investor, founder, talent (future)
    pass


class InvestorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)  # verification badge
    verified_at = models.DateTimeField(null=True, blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)  # optional
    country = models.CharField(max_length=2, blank=True)  # ISO 3166-1 alpha-2
    profile_picture = models.ImageField(upload_to="avatars/", blank=True, null=True)
    # JSONField instead of ArrayField (Postgres-only) for SQLite/Postgres portability.
    stage_focus = models.JSONField(default=list, blank=True)
    sector_focus = models.JSONField(default=list, blank=True)
    geo_focus = models.JSONField(default=list, blank=True)
    check_min = models.PositiveIntegerField(null=True, blank=True)
    check_max = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"InvestorProfile({self.user.username})"

    @property
    def is_complete(self):
        return all([self.full_name, self.headline, self.country])
