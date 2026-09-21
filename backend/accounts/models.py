from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # investor, founder, talent (future)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    # Legacy Microsoft Entra External ID identifier (the `oid` claim). Kept
    # after the Firebase cutover so accounts created under Entra stay
    # identifiable (and the cutover stays reversible); nothing authenticates
    # against it any more.
    entra_oid = models.UUIDField(null=True, blank=True, unique=True, db_index=True)
    # Firebase Authentication UID — the current identity key. A string, not a
    # UUID: Firebase UIDs are opaque 28-char tokens, not UUIDs. Null for rows
    # that predate the cutover until their owner signs in once, at which point
    # provisioning links them by verified email.
    firebase_uid = models.CharField(
        max_length=128, null=True, blank=True, unique=True, db_index=True
    )

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
    # Base city, declared — never inferred from IP. `city` is what the person
    # typed and what we show back; `city_key` is the normalized form we count
    # and filter on, so "Lisboa" and "Lisbon" are one city (accounts/cities.py).
    # Both live here next to country because location is one idea, and they
    # share its visibility section.
    city = models.CharField(max_length=80, blank=True)
    city_key = models.CharField(max_length=80, blank=True, db_index=True)
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
        "credentials": "public",
    }
    DEFAULT_ATTESTATION_PREFS = {
        "show_verified_badge": True,
        "show_memberships": True,
        "show_posts_count": True,
    }

    def __str__(self):
        return f"InvestorProfile({self.user.username})"

    def save(self, *args, **kwargs):
        # Derived here rather than in the serializer so no write path can
        # leave the two out of step — /admin, a shell, a data migration and
        # the API all go through save().
        from .cities import clean_city, normalize_city

        self.city = clean_city(self.city)
        self.city_key = normalize_city(self.city)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "city" in update_fields:
            kwargs["update_fields"] = {*update_fields, "city_key"}
        return super().save(*args, **kwargs)

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
