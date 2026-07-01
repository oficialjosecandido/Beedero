from django.conf import settings
from django.db import models

from .constants import ALWAYS_ON_KINDS, DEFAULT_VISIBILITY_BY_NATURE, NATURE_BY_KIND, SectionKind


class Visibility(models.TextChoices):
    PUBLIC = "public"
    RESTRICTED = "restricted"
    PRIVATE = "private"  # só dentro da org


class Organization(models.Model):
    slug = models.SlugField(unique=True)  # beedero.com/o/<slug>
    name = models.CharField(max_length=200)
    is_verified = models.BooleanField(default=False)
    is_fundraising = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Atributos públicos e diretamente filtráveis pelo motor de descoberta (§6).
    # Não substituem o OrgField genérico — são a fatia estável e sempre-pública
    # usada só para filtros de discovery.
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


class OrgSection(models.Model):
    org = models.ForeignKey(Organization, related_name="sections", on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=SectionKind.choices)
    visibility = models.CharField(max_length=12, choices=Visibility.choices, default=Visibility.PUBLIC)
    position = models.PositiveIntegerField(default=0)
    # Secções de fundraise são arquivadas (não apagadas) ao fechar a ronda.
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
    """Campo granular dentro de uma secção. Cada linha tem a sua visibilidade -> protegível por RLS."""

    section = models.ForeignKey(OrgSection, related_name="fields", on_delete=models.CASCADE)
    key = models.CharField(max_length=50)  # ex: "mrr", "valuation", "deck_url"
    value = models.JSONField()  # flexível (JSONB no Postgres)
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
    # alvo do grant: uma secção OU um campo específico
    section = models.ForeignKey(OrgSection, null=True, blank=True, on_delete=models.CASCADE)
    field = models.ForeignKey(OrgField, null=True, blank=True, on_delete=models.CASCADE)

    class Principal(models.TextChoices):
        USER = "user"
        ORG = "org"
        ROLE = "role"  # ex: "verified_investor"

    principal_type = models.CharField(max_length=10, choices=Principal.choices)
    principal_id = models.CharField(max_length=100)  # user_id, org_id, ou nome do role

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
