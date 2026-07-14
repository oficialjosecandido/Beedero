from django.conf import settings
from django.db import models

from orgs.models import Organization


class ProfileView(models.Model):
    """Freemium doc §3: one row per non-member profile view (unlike
    `orgs.OrgVisit`, which is get_or_create'd once per visitor — this table
    is append-only so "viewed 12 times" is answerable later)."""

    org = models.ForeignKey(Organization, related_name="profile_views", on_delete=models.CASCADE)
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    viewer_is_investor = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["org", "-viewed_at"])]


class InterestSignal(models.Model):
    """Save/bookmark, expressed interest, investor follow, etc. — whatever
    an investor does that signals interest in an org, captured now so the
    founder-insight product (doc §5) has data the day it launches."""

    class Kind(models.TextChoices):
        SAVED = "saved"
        EXPRESSED_INTEREST = "expressed_interest"
        FOLLOWED = "followed"

    org = models.ForeignKey(Organization, related_name="interest_signals", on_delete=models.CASCADE)
    investor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["org", "-created_at"])]


class DailyOrgStats(models.Model):
    """One row per org per day, written once nightly (doc §3) — the
    dashboard's delta cards sum this instead of scanning raw event tables,
    and it's the only place "new followers" / "profile views" per-day
    numbers live once the underlying events age out."""

    org = models.ForeignKey(Organization, related_name="daily_stats", on_delete=models.CASCADE)
    date = models.DateField()
    followers_count = models.PositiveIntegerField(default=0)  # snapshot as of end of day
    new_followers_count = models.PositiveIntegerField(default=0)  # delta that day
    profile_views_count = models.PositiveIntegerField(default=0)  # count that day

    class Meta:
        constraints = [models.UniqueConstraint(fields=["org", "date"], name="uniq_daily_org_stats_per_day")]
        indexes = [models.Index(fields=["org", "-date"])]
