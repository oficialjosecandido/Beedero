from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from orgs.models import Organization, generate_invite_token


class RoleType(models.TextChoices):
    FOUNDER = "founder"
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"
    VOLUNTEER = "volunteer"
    ADVISOR = "advisor", "Advisor"


class Affiliation(models.Model):
    """A person's claim of working with a real Beedero org — distinct from
    OrgMembership (platform access) and SelfDeclaredExperience (free-text,
    not linked to a real org). Founder status can only ever move to
    verified via registry-certificate review (see affiliations/services.py
    verify_founder_via_registry), never via org confirmation."""

    class Status(models.TextChoices):
        SELF_DECLARED = "self_declared"
        PENDING = "pending"
        VERIFIED = "verified"
        DISPUTED = "disputed"

    class VerifiedVia(models.TextChoices):
        ORG = "org"
        REGISTRY = "registry"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="affiliations", on_delete=models.CASCADE)
    org = models.ForeignKey(Organization, related_name="affiliations", on_delete=models.CASCADE)
    role = models.CharField(max_length=12, choices=RoleType.choices)
    title = models.CharField(max_length=120, blank=True, default="")
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.PENDING)
    verified_via = models.CharField(max_length=10, choices=VerifiedVia.choices, blank=True, default="")
    verified_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="+", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["org", "status"]), models.Index(fields=["user"])]

    def __str__(self):
        return f"{self.user_id}@{self.org_id}: {self.role} ({self.status})"


class TeamInviteOptOut(models.Model):
    """"Don't invite me again" — the escape hatch every invite email carries.

    Doc `beedero-aquisicao-pessoas.md` §2.4: "Cada email tem link para recusar
    e para não voltar a receber convites dessa org." Declining one invite and
    refusing all future ones are different intentions, so they are different
    actions; this model records the second.

    `org` null means every organisation on Beedero, which is what someone who
    never wants to hear from us again is asking for. Checked before any invite
    is created, so an opt-out is not merely a filter on sending — the row is
    never written at all.

    Keyed by email rather than by user because the whole point is that the
    person has no account. An address that later signs up keeps the opt-out:
    nothing here is tied to a session.
    """

    email = models.EmailField()
    org = models.ForeignKey(
        Organization,
        related_name="team_invite_opt_outs",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Two rows for the same pair say nothing a single row doesn't. The
            # org-wide and the global opt-out coexist on purpose: one is not the
            # other, and withdrawing one must not silently withdraw the other.
            models.UniqueConstraint(
                fields=["email", "org"],
                name="uniq_team_invite_opt_out",
            ),
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(org__isnull=True),
                name="uniq_global_team_invite_opt_out",
            ),
        ]
        indexes = [models.Index(fields=["email"])]

    def __str__(self):
        return f"{self.email} ✗ {self.org_id or 'all orgs'}"


class TeamInvite(models.Model):
    """An organisation inviting one named person, by email, who has no account.

    Doc `beedero-aquisicao-pessoas.md` §2.2. Deliberately a separate model from
    `orgs.OrgInvite`, which is a shareable link that grants platform membership
    to whoever opens it. This is the opposite in both halves: it names one
    address, and what it grants is a *verified affiliation* — a fact about the
    person's history that the org is attesting to.

    That is why accepting can produce `Affiliation(status=verified)` in one
    step, where a self-declaration would sit at `pending` waiting for the org.
    Both parties have spoken: the org wrote the invite, and the person accepted
    it on a screen built for the purpose. §9 lists that explicit screen as
    non-negotiable, and `accept()` is unreachable without it — nothing in this
    codebase accepts an invite as a side effect of signing in.

    The email is kept only while the invite is live. `expire()` clears it, so
    an address that was invited and ignored for thirty days leaves no record of
    having been invited (§2.2: "Expira aos 30 dias e o email é apagado").
    """

    # 30 days, per §2.2. Long enough that a holiday doesn't lose the invite,
    # short enough that the address isn't held indefinitely.
    TTL_DAYS = 30
    # One reminder, after 3 days, and only if there has been no answer (§2.2).
    REMINDER_AFTER_DAYS = 3
    # §2.4. Per-org, not per-admin: the limit exists to stop an organisation
    # becoming a mailing list, and whose login sent them is beside the point.
    MAX_PER_DAY = 20
    MAX_PER_WEEK = 50

    org = models.ForeignKey(Organization, related_name="team_invites", on_delete=models.CASCADE)
    # Stored lowercased — `normalize_email` in services does it on the way in,
    # so the open-invite uniqueness constraint below can't be sidestepped by
    # changing the case of an address.
    email = models.EmailField()
    name = models.CharField(max_length=120, blank=True, default="")
    role = models.CharField(max_length=12, choices=RoleType.choices)
    title = models.CharField(max_length=120, blank=True, default="")
    started_on = models.DateField(null=True, blank=True)
    token = models.CharField(max_length=64, unique=True, default=generate_invite_token)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reminded_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    declined_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            # One open invite per address per org. Without this, "add team"
            # clicked twice is two emails, and §2.4's "um convite + um
            # lembrete" stops being true.
            models.UniqueConstraint(
                fields=["org", "email"],
                condition=models.Q(
                    accepted_at__isnull=True,
                    declined_at__isnull=True,
                    expired_at__isnull=True,
                ),
                name="uniq_open_team_invite",
            ),
        ]
        indexes = [
            models.Index(fields=["org", "created_at"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"invite {self.pk} → {self.email or '(cleared)'} @ {self.org_id}"

    @property
    def is_open(self) -> bool:
        return (
            self.accepted_at is None
            and self.declined_at is None
            and self.expired_at is None
            and self.expires_at > timezone.now()
        )

    @property
    def answer(self) -> str:
        """What happened to it — for the org's "who's still outstanding" list."""
        if self.accepted_at is not None:
            return "accepted"
        if self.declined_at is not None:
            return "declined"
        if self.expired_at is not None or self.expires_at <= timezone.now():
            return "expired"
        return "open"

    @property
    def needs_reminder(self) -> bool:
        return (
            self.is_open
            and self.reminded_at is None
            and timezone.now() >= self.created_at + timedelta(days=self.REMINDER_AFTER_DAYS)
        )


class TeamInviteReport(models.Model):
    """"This shouldn't have been sent to me" — a complaint, awaiting a human.

    The counterweight to being the one feature that emails people who never
    asked. §2.4 leaves the legal basis for that open; whatever it turns out to
    be, it is worth nothing without a way for the recipient to object and have
    somebody read the objection. So this is deliberately not an auto-moderated
    counter: a row here is pending until an admin resolves it by hand, and
    `resolution` records what they decided.

    No address is stored. The report points at the invite, and reporting
    declines it, which clears the address from the invite as a decline always
    does — the block that reporting creates lives in `TeamInviteOptOut`, which
    is the one place that has to keep an address in order to honour it. An
    admin who needs to reach the complainant has the org and the timestamp;
    they do not need the address, and keeping a copy here to make the
    backoffice marginally more convenient would undo the deletion we promised.
    """

    class Reason(models.TextChoices):
        NOT_ME = "not_me", "I never worked there"
        UNWANTED = "unwanted", "I didn't ask to be contacted"
        IMPERSONATION = "impersonation", "Someone is pretending to be me"
        OTHER = "other", "Something else"

    invite = models.ForeignKey(TeamInvite, related_name="reports", on_delete=models.CASCADE)
    org = models.ForeignKey(
        Organization, related_name="team_invite_reports", on_delete=models.CASCADE
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resolution = models.TextField(blank=True, default="")

    class Meta:
        # Unresolved first, newest first within that — the admin list is a
        # queue, and the default ordering is what makes it one.
        ordering = ["resolved_at", "-created_at"]
        indexes = [
            models.Index(fields=["resolved_at", "-created_at"]),
            models.Index(fields=["org", "-created_at"]),
        ]

    def __str__(self):
        state = "resolved" if self.resolved_at else "PENDING"
        return f"report {self.pk} ({self.get_reason_display()}) — {state}"

    @property
    def is_pending(self) -> bool:
        return self.resolved_at is None
