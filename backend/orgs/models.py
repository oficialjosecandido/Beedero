import secrets
from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone

from .constants import DEFAULT_VISIBILITY_BY_NATURE, NATURE_BY_KIND, SectionKind


def generate_invite_token():
    return secrets.token_urlsafe(24)


class Visibility(models.TextChoices):
    PUBLIC = "public"
    RESTRICTED = "restricted"
    PRIVATE = "private"  # org-internal only


class Organization(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        LIVE = "live"

    slug = models.SlugField(unique=True)  # beedero.com/o/<slug>
    name = models.CharField(max_length=200)
    one_liner = models.CharField(max_length=140, blank=True, default="")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    logo = models.ImageField(upload_to="org_logos/", blank=True, null=True)
    is_verified = models.BooleanField(default=False, db_index=True)
    is_fundraising = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Public attributes, directly filterable by the discovery engine (§6).
    # They don't replace the generic OrgField — they're the stable, always-public
    # slice used only for discovery filters.
    stage = models.CharField(max_length=20, blank=True, db_index=True)
    sector = models.CharField(max_length=50, blank=True, db_index=True)
    # HQ / main team location for discovery filters and density KPIs.
    # Not customer markets (→ market thesis) or legal domicile (→ verification).
    geo = models.CharField(max_length=50, blank=True, db_index=True)

    def __str__(self):
        return self.slug


class OrgMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner"
        ADMIN = "admin"
        MEMBER = "member"
        ADVISOR = "advisor", "Advisor"
        BOARD = "board", "Board member"
        FRACTIONAL = "fractional", "Fractional executive"

    org = models.ForeignKey(Organization, related_name="members", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    title = models.CharField(max_length=120, blank=True, default="")
    # Relationship window shown on the person's timeline (accounts/timeline.py).
    # Removing a member still hard-deletes (see delete()); setting ended_on is
    # the way to mark an engagement concluded while keeping it in the timeline.
    started_on = models.DateField(default=date.today)
    ended_on = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("org", "user")


class MembershipSkill(models.Model):
    """A skill the member declares they used in this affiliation — anchored
    to a real OrgMembership, so it carries the relationship's own dates as
    context even before an org admin confirms it (accounts/timeline.py §5)."""

    membership = models.ForeignKey(OrgMembership, related_name="skills_used", on_delete=models.CASCADE)
    skill = models.CharField(max_length=40)

    class Status(models.TextChoices):
        DECLARED = "declared"
        ORG_CONFIRMED = "org_confirmed"

    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DECLARED)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["membership", "skill"], name="uniq_membership_skill"),
        ]


class OrgInvite(models.Model):
    """Shareable link that grants org membership on accept. Single-use by
    default; deleted once its usage cap is reached."""

    org = models.ForeignKey(Organization, related_name="invites", on_delete=models.CASCADE)
    token = models.CharField(max_length=64, unique=True, default=generate_invite_token)
    role = models.CharField(max_length=20, choices=OrgMembership.Role.choices, default=OrgMembership.Role.MEMBER)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    uses_count = models.PositiveIntegerField(default=0)

    @property
    def is_active(self):
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at <= timezone.now():
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True


class OrgVisit(models.Model):
    """One row per distinct outside (non-member) viewer of the org's profile."""

    org = models.ForeignKey(Organization, related_name="visits", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("org", "user")


class OrgFollow(models.Model):
    org = models.ForeignKey(Organization, related_name="followers", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="followed_orgs", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("org", "user")


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
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

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


class Activity(models.Model):
    """A feed post — org update or investor post. Replaces OrgField-as-post
    (key startswith 'post_') and accounts.InvestorPost, unified so reactions
    and comments have one stable thing to attach to.

    Two nullable FKs + CheckConstraint, matching billing.Subscription's house
    style, instead of a GenericForeignKey: org posts and investor posts will
    likely diverge in fields long before this needs to be generic, and the
    RLS policy below is a literal join, which a GFK would make much harder
    to reason about.
    """

    class Kind(models.TextChoices):
        NEWS = "news"
        MILESTONES = "milestones"
        EVENTS = "events"
        AWARDS = "awards"
        PRESS = "press"
        UPDATE = "update"  # investor-only, no org equivalent

    org = models.ForeignKey(
        Organization, null=True, blank=True, related_name="activities", on_delete=models.CASCADE
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="activities", on_delete=models.CASCADE
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    image = models.ImageField(upload_to="activities/", blank=True, null=True)
    occurred_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    # Snapshotted at creation time (from the section's visibility for org
    # posts; always public for investor posts) rather than re-derived live —
    # a section's visibility changing later doesn't retroactively change
    # already-posted activities.
    visibility = models.CharField(max_length=12, choices=Visibility.choices, default=Visibility.PUBLIC)
    created_at = models.DateTimeField(auto_now_add=True)

    reaction_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    feed_impression_count = models.PositiveIntegerField(default=0)
    payload = models.JSONField(default=dict, blank=True)

    # Backfill breadcrumbs, not FKs (source rows may be pruned later).
    # Uniqueness makes the backfill migration idempotent/re-runnable.
    source_org_field_id = models.PositiveIntegerField(null=True, blank=True, unique=True)
    source_investor_post_id = models.PositiveIntegerField(null=True, blank=True, unique=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(org__isnull=False) | models.Q(author__isnull=False),
                name="activity_has_a_subject",
            )
        ]
        indexes = [
            models.Index(fields=["org", "-occurred_at"]),
            models.Index(fields=["author", "-occurred_at"]),
        ]

    def __str__(self):
        subject = self.org.slug if self.org_id else self.author_id
        return f"{subject}: {self.title}"


class FundraiseRound(models.Model):
    class Stage(models.TextChoices):
        PRE_SEED = "pre_seed"
        SEED = "seed"
        SERIES_A = "series_a"

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="fundraise_rounds")
    valuation = models.BigIntegerField(null=True, blank=True)
    ask_amount = models.BigIntegerField(null=True, blank=True)
    raised_amount = models.BigIntegerField(null=True, blank=True)
    use_of_funds = models.TextField(blank=True)
    stage = models.CharField(max_length=20, choices=Stage.choices)
    is_open = models.BooleanField(default=True)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]


class RestrictedAccessLog(models.Model):
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    org = models.ForeignKey(Organization, on_delete=models.CASCADE)
    field_key = models.CharField(max_length=50)
    section_kind = models.CharField(max_length=30)
    accessed_at = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["org", "section_kind", "-accessed_at"])]
