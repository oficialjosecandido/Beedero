from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # investor, founder, talent (future)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    # Stable Microsoft Entra External ID identifier (the `oid` claim). Never
    # the email — Entra lets users change that. Null for users who haven't
    # authenticated via Entra yet (see accounts/provisioning.py).
    entra_oid = models.UUIDField(null=True, blank=True, unique=True, db_index=True)

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None


class InvestorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)  # verification badge
    verified_at = models.DateTimeField(null=True, blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)  # optional
    country = models.CharField(max_length=2, blank=True)  # ISO 3166-1 alpha-2
    profile_picture = models.ImageField(upload_to="avatars/", blank=True, null=True)
    manifesto = models.CharField(max_length=600, blank=True)  # optional brand-voice sentence
    links = models.JSONField(default=list, blank=True)  # [{"label": "Site", "url": ...}]
    skills = models.JSONField(default=list, blank=True)  # free skills cloud, see accounts.skills
    # JSONField instead of ArrayField (Postgres-only) for SQLite/Postgres portability.
    stage_focus = models.JSONField(default=list, blank=True)
    sector_focus = models.JSONField(default=list, blank=True)
    geo_focus = models.JSONField(default=list, blank=True)  # same values as Organization.geo
    check_min = models.PositiveIntegerField(null=True, blank=True)
    check_max = models.PositiveIntegerField(null=True, blank=True)
    # Public shareable handle for /p/<handle> — assigned automatically.
    handle = models.SlugField(max_length=50, unique=True, blank=True, null=True, db_index=True)
    # Per-section visibility: public | verified_investors | private
    visibility = models.JSONField(default=dict, blank=True)
    # Opt-in for platform-attested facts shown on the public profile.
    attestation_prefs = models.JSONField(default=dict, blank=True)

    DEFAULT_VISIBILITY = {
        "bio": "public",
        "country": "public",
        "memberships": "public",
        "posts": "public",
        "attestations": "public",
        "skills": "public",
    }
    DEFAULT_ATTESTATION_PREFS = {
        "show_verified_badge": True,
        "show_memberships": True,
        "show_posts_count": True,
    }

    def __str__(self):
        return f"InvestorProfile({self.user.username})"

    def merged_visibility(self) -> dict:
        return {**self.DEFAULT_VISIBILITY, **(self.visibility or {})}

    def merged_attestation_prefs(self) -> dict:
        return {**self.DEFAULT_ATTESTATION_PREFS, **(self.attestation_prefs or {})}

    @property
    def is_complete(self):
        return all([self.full_name, self.headline, self.country])

    @property
    def has_public_handle(self) -> bool:
        return bool(self.handle)

    def ensure_handle(self) -> bool:
        from .handles import ensure_profile_handle

        return ensure_profile_handle(self)


class InvestorPost(models.Model):
    class Kind(models.TextChoices):
        MILESTONE = "milestone"
        EVENT = "event"
        UPDATE = "update"

    author = models.ForeignKey(User, related_name="posts", on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    image = models.ImageField(upload_to="investor_posts/", blank=True, null=True)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self):
        return f"{self.author}: {self.title}"


class SelfDeclaredExperience(models.Model):
    """A person's self-declared, unverified past affiliation — org name is
    free text since it may not exist on Beedero at all. Rendered as a
    dashed/light band on the timeline, distinct from verified OrgMembership
    bands (see accounts/timeline.py)."""

    user = models.ForeignKey(User, related_name="self_declared_experiences", on_delete=models.CASCADE)
    org_name = models.CharField(max_length=200)
    role = models.CharField(max_length=120, blank=True)
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)  # None = ongoing
    skills = models.JSONField(default=list, blank=True)  # always "declared" tier — no org to confirm
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_on"]

    def __str__(self):
        return f"{self.user}: {self.org_name}"
