from django.conf import settings
from django.db import models

from orgs.models import Activity, Organization


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


class PersonProfileView(models.Model):
    """Append-only views of a person's public profile (/p/<handle>)."""

    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="person_profile_views", on_delete=models.CASCADE
    )
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="person_profiles_viewed",
        on_delete=models.SET_NULL,
    )
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["subject", "-viewed_at"])]


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


class ActivityFeedImpression(models.Model):
    """One row the first time an authenticated user is served an activity in
    their feed — used for post-level "how many people saw this" metrics."""

    activity = models.ForeignKey(
        Activity, related_name="feed_impressions", on_delete=models.CASCADE
    )
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="activity_feed_impressions",
        on_delete=models.CASCADE,
    )
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "viewer"],
                name="uniq_feed_impression_per_viewer_per_activity",
            )
        ]
        indexes = [models.Index(fields=["activity", "-viewed_at"])]


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


class PipelineEntry(models.Model):
    """Private deal-flow list for an investor — never visible to founders."""

    class Stage(models.TextChoices):
        WATCHING = "watching", "Watching"
        REVIEWING = "reviewing", "Reviewing"
        MEETING = "meeting", "Meeting"
        DILIGENCE = "diligence", "Diligence"
        PASSED = "passed", "Passed"
        INVESTED = "invested", "Invested"

    investor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="pipeline_entries", on_delete=models.CASCADE
    )
    org = models.ForeignKey(Organization, related_name="pipeline_entries", on_delete=models.CASCADE)
    stage = models.CharField(max_length=12, choices=Stage.choices, default=Stage.WATCHING)
    note = models.TextField(max_length=2000, blank=True, default="")
    pass_reason = models.CharField(max_length=200, blank=True, default="")
    next_action_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pipeline entry"
        verbose_name_plural = "Pipeline entries"
        constraints = [
            models.UniqueConstraint(fields=["investor", "org"], name="uniq_pipeline_entry"),
        ]
        indexes = [models.Index(fields=["investor", "stage"])]
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"pipeline:{self.investor_id}:{self.org_id} ({self.stage})"


class SitePageView(models.Model):
    """First-party marketing/app page views — pseudonymous visitor hash only."""

    path = models.CharField(max_length=300)
    visitor_hash = models.CharField(max_length=32, db_index=True)
    is_authenticated = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["path", "-viewed_at"])]


class DailySiteStats(models.Model):
    """Nightly rollup of site traffic for long-term reporting."""

    date = models.DateField(unique=True)
    page_views = models.PositiveIntegerField(default=0)
    unique_visitors = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"site:{self.date} ({self.unique_visitors} visitors)"


class UserActiveDay(models.Model):
    """One row per person per day (Europe/Lisbon) on which they made at least
    one authenticated request. The raw material for retention: "of the people
    who joined in week N, how many were back in week N+1, N+2…" needs every
    active day, which `User.last_seen_at` alone (the latest one) can't give.

    At most one row per user per day, so it stays small: 1,000 daily users is
    ~365k rows a year. Deleted with the user (CASCADE)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="active_days", on_delete=models.CASCADE
    )
    day = models.DateField()
    # True = reconstructed by `backfill_active_days` from actions already in
    # the database (posts, messages, views…) for days before tracking existed.
    # A lower bound: a day someone only browsed left no trace. False = observed
    # directly by accounts.activity.record_presence().
    inferred = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "day"], name="uniq_user_active_day"),
        ]
        indexes = [models.Index(fields=["day"])]

    def __str__(self):
        return f"active:{self.user_id}:{self.day}{' (inferred)' if self.inferred else ''}"
