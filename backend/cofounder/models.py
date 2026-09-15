"""Find a co-founder — person-to-person matching (doc "Beedero — Find a
Co-Founder", v0.1).

Familiar CoffeeSpace mechanics (rich card -> mutual interest -> match ->
conversation), filtered through Beedero's own principles: the ranking signal
is verification and credibility, never the photo, and there is no swipe
gamification. The person-level facet mirrors advisory.AdvisorProfile: an
optional capability a User turns on, never a user type or a public label.
"""

from django.conf import settings
from django.db import models


class Strength(models.TextChoices):
    """What a builder brings, and (as `looking_for`) what they need from the
    other side. Shared by both fields so complementarity is a set operation,
    not a mapping between two vocabularies."""

    TECHNICAL = "technical", "Technical"
    BUSINESS = "business", "Business"
    PRODUCT = "product", "Product"
    DESIGN = "design", "Design"
    OTHER = "other", "Other"


# The personality prompts (doc §1) — the soul of the card. Fixed keys so the
# card renders predictably; free text inside, capped in the serializer.
PROMPT_KEYS = ("why_building", "superpower", "ideal_cofounder")
PROMPT_MAX_LENGTH = 280


class BuilderProfile(models.Model):
    """The "looking for a co-founder" facet of a User. Skills and location
    are deliberately absent — they're read from accounts.InvestorProfile
    (doc §6: "skills reutilizadas do perfil pessoal, não repetir")."""

    class Commitment(models.TextChoices):
        EXPLORING = "exploring", "Exploring ideas"
        NIGHTS_WEEKENDS = "nights", "Nights & weekends"
        FULL_TIME = "full_time", "Full-time"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="builder"
    )
    # False by default, unlike the doc's sketch: the profile row is created
    # lazily on the first GET (same get_or_create as AdvisorProfileView), so
    # defaulting to True would opt a person in merely for opening the page.
    # Opting in is an explicit act — activate_profile() is the only way here.
    is_active = models.BooleanField(default=False)
    # Doc §7: 18+ is a Terms requirement for a person-to-person contact
    # product. Recorded per-person because nothing else on the account
    # carries age, and enforced as a precondition of is_active.
    adult_confirmed = models.BooleanField(default=False)

    # What the builder brings.
    primary_strength = models.CharField(
        max_length=20, choices=Strength.choices, blank=True, default=""
    )
    # What they're looking for — JSONField rather than ArrayField for the
    # same reason as AdvisorProfile.expertise: Postgres-only types keep the
    # models tied to one backend for no gain at this size.
    looking_for = models.JSONField(default=list, blank=True)

    # How much time they can actually give — a hard compatibility signal
    # between two people choosing each other as partners.
    commitment = models.CharField(
        max_length=20, choices=Commitment.choices, blank=True, default=""
    )

    sectors = models.JSONField(default=list, blank=True)  # same values as Organization.sector
    has_idea = models.BooleanField(default=False)
    idea_pitch = models.CharField(max_length=280, blank=True, default="")

    prompts = models.JSONField(default=dict, blank=True)  # see PROMPT_KEYS

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["is_active", "primary_strength"])]

    def __str__(self):
        return f"BuilderProfile({self.user_id})"

    @property
    def is_complete(self) -> bool:
        """The minimum a card needs to be worth showing anyone."""
        return bool(self.primary_strength and self.commitment and self.looking_for)


class CofounderInterest(models.Model):
    """A decides on B. `liked=True` is "Interested", False is "Pass" — a
    considered choice shown as such, never a swipe. A match is mutual
    interest; see services.record_interest."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="cofounder_interests_sent", on_delete=models.CASCADE
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="cofounder_interests_received",
        on_delete=models.CASCADE,
    )
    liked = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["actor", "target"], name="uniq_cofounder_interest"),
            models.CheckConstraint(
                condition=~models.Q(actor=models.F("target")), name="no_self_cofounder_interest"
            ),
        ]
        indexes = [models.Index(fields=["target", "liked"])]

    def __str__(self):
        verb = "likes" if self.liked else "passed on"
        return f"{self.actor_id} {verb} {self.target_id}"


class CofounderMatch(models.Model):
    """Mutual interest. Ordered pair (user_a_id < user_b_id, enforced by the
    constraint below) so A-B and B-A can never both exist — the same rule as
    messaging.Conversation and connections.Connection; services sort the pair
    before lookup/creation.

    The post-match chat is the ordinary DM thread (`conversation`), not a
    private message table: mutual acceptance is exactly what opens a
    conversation everywhere else on Beedero, and reusing it means block,
    report, unread counts and the inbox all work here for free. That the
    thread is only ever created here is what enforces "chat only with a
    match" — POST /api/conversations/ still refuses to open one between two
    people who aren't connected."""

    class Outcome(models.TextChoices):
        MATCHED = "matched", "Matched"
        CHATTING = "chatting", "Chatting"
        MET = "met", "Met in person"
        FORMED_ORG = "formed_org", "Formed an organization"
        ARCHIVED = "archived", "Archived"

    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="cofounder_matches_a", on_delete=models.CASCADE
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="cofounder_matches_b", on_delete=models.CASCADE
    )
    conversation = models.ForeignKey(
        "messaging.Conversation", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    outcome = models.CharField(max_length=20, choices=Outcome.choices, default=Outcome.MATCHED)
    # The mother metric (doc §6): the funnel closes when a match becomes a
    # real organization on Beedero.
    org = models.ForeignKey(
        "orgs.Organization", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user_a__lt=models.F("user_b")),
                name="cofounder_match_ordered_pair",
            ),
            models.UniqueConstraint(fields=["user_a", "user_b"], name="uniq_cofounder_match"),
        ]

    def __str__(self):
        return f"cofounder match {self.pk} ({self.user_a_id}, {self.user_b_id})"

    def other_user(self, viewer):
        return self.user_b if self.user_a_id == viewer.id else self.user_a
