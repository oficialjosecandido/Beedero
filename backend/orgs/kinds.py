"""Startups and companies — everything that differs, in one place.

A **startup** has no company yet. A **company** is incorporated: its
certidão permanente can be checked. Everything not listed here is the same
for both.

  price       startups €33/year or €3/month; companies €99/year or €9/month
              (billing/plans.py)
  ladder      startups have seven rungs: there is no registry to check, and
              Beedero's own confirmation is done by hand in the Nexus
              (orgs/ladder.py)
  tools       co-founder roles are for startups; stock options, rounds past
              pre-seed (valuation, financials, data room, cap table) and
              recorded investments need a company
  changing    a startup becomes a company when its registry check is approved
              (credibility/services.py) or when an admin changes it in the
              Nexus. The team can't switch back on its own.

Founder status is still verified only through the certidão permanente: a
startup's founders stay unverified as founders until it is a company, and
the Nexus confirmation is about the organisation, never about who founded it.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .constants import FUNDRAISE_KINDS, SectionKind
from .models import Organization, OrgSection, VisibilityGrant

STARTUP = Organization.Kind.STARTUP
COMPANY = Organization.Kind.COMPANY

# Job engagement / compensation values (jobs/models.py) each kind can't use.
STARTUP_ONLY_ENGAGEMENTS = frozenset({"cofounder"})
COMPANY_ONLY_COMPENSATION = frozenset({"stock_options"})

STARTUP_ROUND_STAGES = frozenset({"pre_seed"})
STARTUP_FUNDRAISE_KINDS = [SectionKind.ASK, SectionKind.USE_OF_FUNDS]

COFOUNDER_FOR_STARTUPS = (
    "Co-founder roles are for startups. Companies can post every other kind of role."
)
STOCK_OPTIONS_FOR_COMPANIES = (
    "Stock options need a company. A startup can offer equity instead."
)
ROUND_STAGE_FOR_STARTUPS = (
    "Startups raise pre-seed. Seed and Series A rounds open once you're a company."
)
VALUATION_FOR_COMPANIES = (
    "A valuation needs a company. Add it once you're incorporated."
)
INVESTMENTS_FOR_COMPANIES = "This startup isn't incorporated yet. Investments are recorded once it is a company."


def is_startup(org) -> bool:
    return org.kind == STARTUP


# ------------------------------------------------------------------- jobs


def check_job(org, *, engagement_type=None, compensation_kinds=()) -> None:
    """Raise if this kind of organisation can't post that role. Only what is
    being set is checked, so a job posted before a change of kind can still be
    edited."""
    errors = {}
    if engagement_type in STARTUP_ONLY_ENGAGEMENTS and not is_startup(org):
        errors["engagement_type"] = [COFOUNDER_FOR_STARTUPS]
    if is_startup(org) and COMPANY_ONLY_COMPENSATION.intersection(compensation_kinds):
        errors["compensation"] = [STOCK_OPTIONS_FOR_COMPANIES]
    if errors:
        raise ValidationError(errors)


# ------------------------------------------------------------ fundraising


def check_round(org, data: dict) -> None:
    if not is_startup(org):
        return
    errors = {}
    if data.get("stage") not in STARTUP_ROUND_STAGES:
        errors["stage"] = [ROUND_STAGE_FOR_STARTUPS]
    if data.get("valuation") not in (None, ""):
        errors["valuation"] = [VALUATION_FOR_COMPANIES]
    if errors:
        raise ValidationError(errors)


def fundraise_kinds(org) -> list:
    return STARTUP_FUNDRAISE_KINDS if is_startup(org) else FUNDRAISE_KINDS


def open_fundraise_sections(org) -> None:
    """The restricted sections of an open round — only the ask and the use of
    funds for a startup — each visible to verified investors."""
    for kind in fundraise_kinds(org):
        section, _ = OrgSection.objects.get_or_create(org=org, kind=kind)
        if section.archived_at is not None:
            section.archived_at = None
            section.save(update_fields=["archived_at"])
        VisibilityGrant.objects.get_or_create(
            org=org,
            section=section,
            principal_type=VisibilityGrant.Principal.ROLE,
            principal_id="verified_investor",
        )


# ------------------------------------------------------------ investments


def check_investment(org) -> None:
    if is_startup(org):
        raise ValidationError({"org": INVESTMENTS_FOR_COMPANIES})


# ------------------------------------------------------------------ change


def change_kind(org, kind: str, *, reason: str, actor=None) -> bool:
    """Make the organisation a startup or a company. Returns False when it
    already was one. The plan moves to the new price (billing/subscriptions.py
    `kind_changed`, after the commit), the owners are told, and the change is
    in the Nexus audit log whoever made it."""
    if kind not in Organization.Kind.values:
        raise ValidationError({"kind": ["Choose startup or company."]})
    if org.kind == kind:
        return False
    with transaction.atomic():
        previous = org.kind
        org.kind = kind
        org.kind_changed_at = timezone.now()
        org.save(update_fields=["kind", "kind_changed_at"])
        if kind == COMPANY and org.is_fundraising:
            # A round opened as a startup gains the company's sections.
            open_fundraise_sections(org)

        from nexus import audit
        from nexus.models import NexusAction

        audit.record(
            actor,
            NexusAction.Action.ORG_KIND,
            target_type="org",
            target_id=org.slug,
            label=org.name,
            reason=reason,
            kind=kind,
            previous=previous,
        )

        from billing.subscriptions import kind_changed

        transaction.on_commit(lambda: kind_changed(org))
    return True
