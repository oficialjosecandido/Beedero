"""The organisation's verification ladder — eight rungs, one path, one gate.

The same shape as the person's (accounts/ladder.py), so the two read alike:

  1–4  The team       — things the team can do alone, in minutes. All four
                        together are 50%: the organisation can be published,
                        and only then does it show up in Discover.
  5–7  Someone else   — a person who confirms they work here, the company
                        registry, and Beedero.
  8    The record     — seven days in a row with an update.

Rung 4 ties the two ladders together: an organisation is only listed when at
least one person on its team has passed their *own* gate. Nothing faceless
gets into Discover.

Why publishing still takes a click: going public is a decision a company
makes, not a side effect of filling in a form. The gate decides *whether* it
can publish; the owner decides *when*. After that, Discover re-checks the
gate on every listing — an organisation that drops below it (the only
finished profile on the team leaves, the logo is removed) keeps its public
page but stops being listed until it is back above.

`is_org_unlocked()` (one org) and `with_org_unlock()` (a queryset, for
listings) encode the same rule twice. orgs/test_ladder.py holds them together.
"""

import math
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from .completeness import ABOUT_REQUIRED_KEYS, about_complete
from .constants import SectionKind
from .models import Activity, OrgField, OrgMembership

LISBON = ZoneInfo("Europe/Lisbon")

DAILY_STREAK_DAYS = 7
UNLOCK_KEYS = ("owner_confirmed", "who_you_are", "what_you_do", "face_behind_it")
MANAGER_ROLES = (OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN)

# The registry certificate is valid for a year (credibility/services.py);
# the warning has to arrive while there is still time to renew it.
EXPIRY_WARNING_DAYS = 60


# ----------------------------------------------------------- the four gates


def _confirmed_manager(org):
    return (
        OrgMembership.objects.filter(org=org, role__in=MANAGER_ROLES, user__email_verified_at__isnull=False)
        .select_related("user")
        .first()
    )


def _who_you_are(org) -> bool:
    return bool(org.name and org.logo and org.one_liner and org.stage and org.sector and org.geo)


def _has_products(org) -> bool:
    return OrgField.objects.filter(
        section__org=org, section__kind=SectionKind.PRODUCTS, section__archived_at__isnull=True
    ).exists()


def _what_you_do(org) -> bool:
    return about_complete(org) and _has_products(org)


def _unlocked_people():
    from accounts.ladder import with_unlock
    from accounts.models import InvestorProfile

    return with_unlock(InvestorProfile.objects.all()).values("user_id")


def _faces(org):
    """Team members whose own profile passed the person's gate."""
    return OrgMembership.objects.filter(org=org, user_id__in=_unlocked_people()).select_related(
        "user__investorprofile"
    )


def is_org_unlocked(org) -> bool:
    """Rungs 1–4 done: may publish, and is listed in Discover once live."""
    return (
        _confirmed_manager(org) is not None
        and _who_you_are(org)
        and _what_you_do(org)
        and _faces(org).exists()
    )


def gate_missing(org) -> list[str]:
    checks = {
        "owner_confirmed": _confirmed_manager(org) is not None,
        "who_you_are": _who_you_are(org),
        "what_you_do": _what_you_do(org),
        "face_behind_it": _faces(org).exists(),
    }
    return [key for key in UNLOCK_KEYS if not checks[key]]


def _about_key(key: str):
    return Exists(
        OrgField.objects.filter(
            section__org=OuterRef("pk"),
            section__kind=SectionKind.ABOUT,
            section__archived_at__isnull=True,
            key=key,
        )
    )


def with_org_unlock(queryset):
    """Organization queryset → only the ones past rungs 1–4 (same rule as
    `is_org_unlocked`, evaluated in the database)."""
    about = {f"_about_{key}": _about_key(key) for key in sorted(ABOUT_REQUIRED_KEYS)}
    return queryset.annotate(
        _manager_ok=Exists(
            OrgMembership.objects.filter(
                org=OuterRef("pk"), role__in=MANAGER_ROLES, user__email_verified_at__isnull=False
            )
        ),
        _products=Exists(
            OrgField.objects.filter(
                section__org=OuterRef("pk"),
                section__kind=SectionKind.PRODUCTS,
                section__archived_at__isnull=True,
            )
        ),
        _face=Exists(OrgMembership.objects.filter(org=OuterRef("pk"), user_id__in=_unlocked_people())),
        **about,
    ).filter(
        Q(_manager_ok=True)
        & ~Q(name="")
        & Q(logo__isnull=False)
        & ~Q(logo="")
        & ~Q(one_liner="")
        & ~Q(stage="")
        & ~Q(sector="")
        & ~Q(geo="")
        & Q(_products=True)
        & Q(_face=True)
        & Q(**{name: True for name in about})
    )


def listed_in_discover(queryset):
    """Live, past the gate and with a plan — what every org listing reads.
    The plan is not a rung: it is what keeps the organisation switched on
    (billing/access.py)."""
    from billing.access import with_billing_access

    from .models import Organization

    return with_billing_access(with_org_unlock(queryset.filter(status=Organization.Status.LIVE)))


# --------------------------------------------------------------- rungs 5–8


def _registry_state(org) -> dict:
    """The company registry certificate (credibility app, VerificationType
    COMPANY_REGISTRY): done while a verified one is in date; pending while one
    waits for review; a warning when it is about to run out, ran out or was
    turned down."""
    from credibility.models import Verification, VerificationType

    latest = (
        Verification.objects.filter(org=org, type=VerificationType.COMPANY_REGISTRY)
        .order_by("-submitted_at")
        .first()
    )
    verified = (
        Verification.objects.filter(
            org=org, type=VerificationType.COMPANY_REGISTRY, status=Verification.Status.VERIFIED
        )
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=timezone.now()))
        .first()
    )
    state = {"done": verified is not None, "pending": False, "detail": "", "warning": ""}
    if verified is not None:
        state["detail"] = "Certidão permanente checked"
        if verified.valid_until:
            seconds_left = (verified.valid_until - timezone.now()).total_seconds()
            days = math.ceil(seconds_left / 86_400)
            state["detail"] += f" · valid until {verified.valid_until:%d %b %Y}"
            if days <= EXPIRY_WARNING_DAYS:
                unit = "day" if days == 1 else "days"
                state["warning"] = f"Expires in {days} {unit} — send a new access code to keep this step."
    if latest is None:
        return state
    if latest.status == Verification.Status.PENDING:
        state["pending"] = True
    elif not state["done"] and latest.status == Verification.Status.REJECTED:
        reason = f": {latest.rejection_reason}" if latest.rejection_reason else "."
        state["warning"] = f"Not confirmed{reason}"
    elif not state["done"] and latest.status in (Verification.Status.VERIFIED, Verification.Status.EXPIRED):
        state["warning"] = "The last check has expired — send a new access code."
    return state


def longest_daily_run(org) -> int:
    """Longest run of consecutive Lisbon days with at least one post by the org."""
    days = {
        moment.astimezone(LISBON).date()
        for moment in Activity.objects.filter(org=org).values_list("created_at", flat=True)
    }
    best = 0
    for day in days:
        if day - timedelta(days=1) in days:
            continue  # counted from the start of its run
        length = 0
        while day + timedelta(days=length) in days:
            length += 1
        best = max(best, length)
    return best


# ------------------------------------------------------------------ ladder


def org_verification_ladder(org) -> dict:
    from affiliations.models import Affiliation

    from .models import Organization

    manager = _confirmed_manager(org)
    faces = list(_faces(org)[:2])
    confirmed = Affiliation.objects.filter(org=org, status=Affiliation.Status.VERIFIED).count()
    registry = _registry_state(org)
    run = longest_daily_run(org)

    def face_detail() -> str:
        if not faces:
            return ""
        name = faces[0].user.investorprofile.full_name
        return name if len(faces) == 1 else f"{name} and others"

    rungs = [
        {
            "key": "owner_confirmed",
            "band": "team",
            "label": "Owner confirmed",
            "hint": "The owner or an admin signs in with a confirmed email.",
            "done": manager is not None,
            "attested_by": "Their email provider",
            "action": None,
            "detail": manager.user.email if manager else "",
        },
        {
            "key": "who_you_are",
            "band": "team",
            "label": "Who you are",
            "hint": "Name, logo, one-liner, stage, sector and where the team is based.",
            "done": _who_you_are(org),
            "attested_by": "The team",
            "action": "profile",
            # The address only exists once the organisation is published.
            "detail": f"/o/{org.slug}" if org.status == Organization.Status.LIVE else "",
        },
        {
            "key": "what_you_do",
            "band": "team",
            "label": "What you do",
            "hint": "About (summary, mission, vision, values) and at least one product or service.",
            "done": _what_you_do(org),
            "attested_by": "The team",
            "action": "profile",
            "detail": "",
        },
        {
            "key": "face_behind_it",
            "band": "team",
            "label": "A face behind it",
            "hint": "Someone on the team finishes their own profile — photo, a few lines, one role and "
            "three skills. Nothing faceless is listed.",
            "done": bool(faces),
            "attested_by": "The team",
            "action": "personal_profile",
            "detail": face_detail(),
        },
        {
            "key": "team_confirmed",
            "band": "others",
            "label": "Team confirmed",
            "hint": "Someone confirms on their own profile that they work here.",
            "done": confirmed > 0,
            "attested_by": "Another member",
            "action": "team",
            "detail": (
                f"{confirmed} {'person' if confirmed == 1 else 'people'} confirmed" if confirmed else ""
            ),
        },
        {
            "key": "registry_confirmed",
            "band": "others",
            "label": "Registry confirmed",
            "hint": "Send the access code of your certidão permanente. We check it against the "
            "commercial registry — no PDF needed.",
            "done": registry["done"],
            "pending": registry["pending"],
            "attested_by": "Company registry",
            "action": "registry",
            "detail": registry["detail"],
            "warning": registry["warning"],
        },
        {
            "key": "beedero_verified",
            "band": "others",
            "label": "Verified by Beedero",
            "hint": "We confirm the organisation is who it says it is: automatically when the owner's "
            "email domain matches its name, otherwise by hand once the registry is confirmed.",
            "done": org.is_verified,
            "attested_by": "Beedero",
            "action": None,
            "detail": "",
        },
        {
            "key": "daily_week",
            "band": "record",
            "label": "A week on the record",
            "hint": f"Post an update every day for {DAILY_STREAK_DAYS} days in a row.",
            "done": run >= DAILY_STREAK_DAYS,
            "attested_by": "Your record",
            "action": "activity",
            "detail": "",
            "progress": min(run, DAILY_STREAK_DAYS),
        },
    ]
    for rung in rungs:
        rung.setdefault("progress", None)
        rung.setdefault("pending", False)
        rung.setdefault("warning", "")

    done = sum(1 for rung in rungs if rung["done"])
    unlock_missing = [r["key"] for r in rungs if r["key"] in UNLOCK_KEYS and not r["done"]]
    live = org.status == Organization.Status.LIVE
    from billing.access import has_access

    plan_active = has_access(org)
    return {
        "rungs": rungs,
        "done_count": done,
        "total_count": len(rungs),
        # Floored, so it never overstates: exactly 50 at the gate.
        "percent": 100 * done // len(rungs),
        # True exactly when is_org_unlocked(org) is — the same four checks.
        "unlocked": not unlock_missing,
        "unlock_missing": unlock_missing,
        "next": next((rung["key"] for rung in rungs if not rung["done"]), None),
        "level": done,
        "status": org.status,
        "plan_active": plan_active,
        "listed": live and not unlock_missing and plan_active,
        "can_publish": not live and not unlock_missing and plan_active,
    }
