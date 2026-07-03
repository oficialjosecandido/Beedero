from django.conf import settings
from django.db import models

from .constants import ALWAYS_ON_KINDS, DEFAULT_VISIBILITY_BY_NATURE, NATURE_BY_KIND, SectionKind


class Visibility(models.TextChoices):
    PUBLIC = "public"
    RESTRICTED = "restricted"
    PRIVATE = "private"  # org-internal only


class Organization(models.Model):
    slug = models.SlugField(unique=True)  # beedero.com/o/<slug>
    name = models.CharField(max_length=200)
    is_verified = models.BooleanField(default=False)
    is_fundraising = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Public attributes, directly filterable by the discovery engine (§6).
    # They don't replace the generic OrgField — they're the stable, always-public
    # slice used only for discovery filters.
    stage = models.CharField(max_length=20, blank=True)
    sector = models.CharField(max_length=50, blank=True)
    geo = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return self.slug


class OrgMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner"
        ADMIN = "admin"
        MEMBER = "member"

    org = models.ForeignKey(Organization, related_name="members", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)

    class Meta:
        unique_together = ("org", "user")


class OrgFollow(models.Model):
    org = models.ForeignKey(Organization, related_name="followers", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="followed_orgs", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("org", "user")


class UserFollow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="following_users", on_delete=models.CASCADE
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="followers", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "followed")


class OrgSection(models.Model):
    org = models.ForeignKey(Organization, related_name="sections", on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=SectionKind.choices)
    visibility = models.CharField(max_length=12, choices=Visibility.choices, default=Visibility.PUBLIC)
    position = models.PositiveIntegerField(default=0)
    # Fundraise sections are archived (not deleted) when the round closes.
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("org", "kind")

    def save(self, *args, **kwargs):
        if self._state.adding and self.visibility == Visibility.PUBLIC:
            nature = NATURE_BY_KIND[self.kind]
            self.visibility = DEFAULT_VISIBILITY_BY_NATURE[nature]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.org.slug}/{self.kind}"


class OrgField(models.Model):
    """Granular field within a section. Each row has its own visibility -> RLS-protectable."""

    section = models.ForeignKey(OrgSection, related_name="fields", on_delete=models.CASCADE)
    key = models.CharField(max_length=50)  # e.g.: "mrr", "valuation", "deck_url"
    value = models.JSONField()  # flexible (JSONB on Postgres)
    visibility = models.CharField(max_length=12, choices=Visibility.choices, default=Visibility.PUBLIC)

    class Meta:
        unique_together = ("section", "key")

    def save(self, *args, **kwargs):
        if self._state.adding and self.visibility == Visibility.PUBLIC:
            self.visibility = self.section.visibility
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.section}:{self.key}"


class VisibilityGrant(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE)
    # grant target: a section OR a specific field
    section = models.ForeignKey(OrgSection, null=True, blank=True, on_delete=models.CASCADE)
    field = models.ForeignKey(OrgField, null=True, blank=True, on_delete=models.CASCADE)

    class Principal(models.TextChoices):
        USER = "user"
        ORG = "org"
        ROLE = "role"  # e.g.: "verified_investor"

    principal_type = models.CharField(max_length=10, choices=Principal.choices)
    principal_id = models.CharField(max_length=100)  # user_id, org_id, or role name

    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def matches(self, principals: set[tuple[str, str]]) -> bool:
        return (self.principal_type, self.principal_id) in principals


class FundraiseRound(models.Model):
    class Stage(models.TextChoices):
        PRE_SEED = "pre_seed"
        SEED = "seed"
        SERIES_A = "series_a"

    org = models.OneToOneField(Organization, on_delete=models.CASCADE)
    valuation = models.BigIntegerField(null=True, blank=True)
    ask_amount = models.BigIntegerField(null=True, blank=True)
    use_of_funds = models.TextField(blank=True)
    stage = models.CharField(max_length=20, choices=Stage.choices)
    is_open = models.BooleanField(default=True)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)


class RestrictedAccessLog(models.Model):
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    org = models.ForeignKey(Organization, on_delete=models.CASCADE)
    field_key = models.CharField(max_length=50)
    section_kind = models.CharField(max_length=30)
    accessed_at = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
