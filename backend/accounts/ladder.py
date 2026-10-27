"""The person's verification ladder — eight rungs, one path, one gate.

Three bands, each rung naming who vouches for it:

  1–4  You            — things a person can do alone, in minutes. All four
                        together are 50% and unlock Discover + sending
                        connection requests (`is_unlocked`).
  5–7  Someone else   — another member, an organisation / registry / startup /
                        issuing body, and Beedero.
  8    Your record    — seven days in a row with a post.

Why the gate sits exactly on the four "You" rungs: anything that needs another
person (a connection, a confirmation) cannot be a condition for being found or
for asking — that would lock newcomers out for good. And why the gate is "rungs
1–4 done" rather than "any four rungs": an empty profile that happens to have a
connection and a posting streak must still not show up in Discover.

A rung, once climbed, stays climbed only while its fact is true: deleting the
photo reopens rung 3 and takes the person out of Discover again. Rung 8 is the
exception by design — "a week on the record" is something that happened, so it
counts the longest run ever; keeping it up is the cadence card's job
(accounts/cadence.py, which owns the Lisbon-day rule this rung reads).

`is_unlocked()` (one profile) and `with_unlock()` (a queryset) encode the same
rule twice — Python for a single check, SQL so Discover never loads profiles it
then throws away. test_ladder.py holds them together. Listings go through
`discoverable()`, which is the gate plus "not an internal account".
"""

import math

from django.db.models import Count, Exists, F, Func, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce, Length, Trim
from django.utils import timezone

from affiliations.models import Affiliation
from connections.models import Connection
from credibility.models import ProfessionalCredential
from investments.models import InvestmentRecord
from orgs.models import MembershipSkill, OrgMembership

from .cadence import longest_daily_run
from .models import SelfDeclaredExperience

MIN_BIO_CHARS = 80
MIN_SKILLS = 3
DAILY_STREAK_DAYS = 7
UNLOCK_KEYS = ("email_confirmed", "who_you_are", "face_and_story", "record_started")

# A credential inside this window is still valid but worth warning about —
# renewing an expired licence is slower than renewing one about to expire.
EXPIRY_WARNING_DAYS = 60


# ----------------------------------------------------------- the four gates


def _who_you_are(profile) -> bool:
    # Country too: /p/<handle> answers 404 without it (InvestorProfile.is_complete),
    # and a Discover card must never lead to a missing page.
    return bool(
        profile.full_name and profile.headline and profile.country and profile.city and profile.handle
    )


def _face_and_story(profile) -> bool:
    return bool(profile.profile_picture) and len((profile.bio or "").strip()) >= MIN_BIO_CHARS


def _has_record(user) -> bool:
    return (
        SelfDeclaredExperience.objects.filter(user=user).exists()
        or Affiliation.objects.filter(user=user).exists()
        or OrgMembership.objects.filter(user=user).exists()
    )


def _skills_count(profile) -> int:
    """Every skill the person has declared, wherever they typed it.

    One idea lives in three stores (accounts/skills.py): the free cloud on the
    profile, the list on each self-declared experience, and the rows anchored
    to a roster membership. The Add experience form writes to the last two, so
    counting only the cloud told people who had just filled in their whole
    professional record that they had declared no skills at all.

    Totals rather than a distinct set: normalize_skills already dedupes inside
    each store, and repeating that across a jsonb column and two tables would
    cost every Discover query (`with_unlock`) more than the overlap is worth.
    """
    own = len(profile.skills) if isinstance(profile.skills, list) else 0
    from_experiences = sum(
        len(skills) if isinstance(skills, list) else 0
        for skills in SelfDeclaredExperience.objects.filter(
            user_id=profile.user_id
        ).values_list("skills", flat=True)
    )
    from_roster = MembershipSkill.objects.filter(membership__user_id=profile.user_id).count()
    return own + from_experiences + from_roster


def _record_started(profile) -> bool:
    return _skills_count(profile) >= MIN_SKILLS and _has_record(profile.user)


def is_unlocked(profile) -> bool:
    """Rungs 1–4 done: may appear in Discover and send connection requests."""
    if profile is None:
        return False
    return (
        profile.user.is_email_verified
        and _who_you_are(profile)
        and _face_and_story(profile)
        and _record_started(profile)
    )


def gate_state(user) -> dict:
    """The viewer's own side of the gate, for screens that need to say "finish
    N steps first" before offering a Connect button that would fail."""
    profile = getattr(user, "investorprofile", None)
    if profile is None:
        return {"unlocked": False, "steps_left": len(UNLOCK_KEYS) - int(user.is_email_verified)}
    checks = (
        user.is_email_verified,
        _who_you_are(profile),
        _face_and_story(profile),
        _record_started(profile),
    )
    left = sum(1 for check in checks if not check)
    return {"unlocked": left == 0, "steps_left": left}


class _SkillsCount(Func):
    """jsonb_array_length, but 0 for anything that is not an array."""

    template = (
        "CASE WHEN jsonb_typeof(%(expressions)s) = 'array' "
        "THEN jsonb_array_length(%(expressions)s) ELSE 0 END"
    )
    output_field = IntegerField()


def with_unlock(queryset):
    """InvestorProfile queryset → only the unlocked ones (same rule as
    `is_unlocked`, evaluated in the database)."""
    return (
        queryset.annotate(
            _bio_len=Length(Trim("bio")),
            # The three skill stores _skills_count adds up, one annotation each.
            _skills_n=_SkillsCount("skills"),
            _exp_skills_n=Coalesce(
                Subquery(
                    SelfDeclaredExperience.objects.filter(user_id=OuterRef("user_id"))
                    .annotate(_n=_SkillsCount("skills"))
                    .values("user_id")
                    .annotate(_total=Sum("_n"))
                    .values("_total")[:1]
                ),
                0,
            ),
            _mem_skills_n=Coalesce(
                Subquery(
                    MembershipSkill.objects.filter(membership__user_id=OuterRef("user_id"))
                    .values("membership__user_id")
                    .annotate(_total=Count("id"))
                    .values("_total")[:1]
                ),
                0,
            ),
            _has_exp=Exists(SelfDeclaredExperience.objects.filter(user_id=OuterRef("user_id"))),
            _has_aff=Exists(Affiliation.objects.filter(user_id=OuterRef("user_id"))),
            _has_mem=Exists(OrgMembership.objects.filter(user_id=OuterRef("user_id"))),
        )
        .annotate(_all_skills_n=F("_skills_n") + F("_exp_skills_n") + F("_mem_skills_n"))
        .filter(
            Q(user__email_verified_at__isnull=False)
            & ~Q(full_name="")
            & ~Q(headline="")
            & ~Q(country="")
            & ~Q(city="")
            & Q(handle__isnull=False)
            & ~Q(handle="")
            & Q(profile_picture__isnull=False)
            & ~Q(profile_picture="")
            & Q(_bio_len__gte=MIN_BIO_CHARS)
            & Q(_all_skills_n__gte=MIN_SKILLS)
            & (Q(_has_exp=True) | Q(_has_aff=True) | Q(_has_mem=True))
        )
    )


def discoverable(queryset):
    """InvestorProfile queryset → the profiles a listing may show to other
    people: past the gate, and not an internal account.

    Internal accounts are the team's own logins and the fixtures (the
    `lighthouse-demo` person, for instance), already excluded from the product
    metrics by the same flag (accounts/models.py). They keep everything else:
    their public page, their connections, their posts. What they must not do is
    pad a list of people a member is asked to connect with.

    Listings use this; the gate on its own (`with_unlock`) stays the answer to
    "may this person be found and ask to connect", which an internal account
    may do like anyone else.
    """
    return with_unlock(queryset).filter(user__is_internal=False)


# --------------------------------------------------------------- rungs 5–8


def _third_party_confirmation(user) -> tuple[str, str] | None:
    """(attested_by, detail) for the first confirmation found, any route."""
    affiliation = (
        Affiliation.objects.filter(user=user, status=Affiliation.Status.VERIFIED)
        .select_related("org")
        .order_by("-verified_at")
        .first()
    )
    if affiliation:
        via_registry = affiliation.verified_via == Affiliation.VerifiedVia.REGISTRY
        role = affiliation.title or affiliation.get_role_display()
        return (
            "Company registry" if via_registry else affiliation.org.name,
            f"{role} at {affiliation.org.name}",
        )
    # A roster row counts only when someone else attested to it: confirming
    # your own details is free (you get a confirmed row by creating the org),
    # so OrgMembership.attested_by_other is the condition, not "confirmed".
    membership = (
        OrgMembership.objects.filter(OrgMembership.ATTESTED_BY_OTHER, user=user)
        .select_related("org")
        .order_by("-details_confirmed_at")
        .first()
    )
    if membership:
        role = membership.title or membership.get_role_display()
        return membership.org.name, f"{role} at {membership.org.name}"
    investment = (
        InvestmentRecord.objects.filter(investor_user=user, status=InvestmentRecord.Status.CONFIRMED)
        .select_related("org")
        .order_by("-confirmed_at")
        .first()
    )
    if investment:
        return investment.org.name, f"Investment in {investment.org.name} confirmed"
    credential = (
        ProfessionalCredential.objects.filter(user=user, status=ProfessionalCredential.Status.VERIFIED)
        .order_by("-verified_at")
        .first()
    )
    if credential:
        return credential.issuer, f"{credential.title} · {credential.identifier}"
    return None


def _credential_warning(user) -> str:
    """Empty unless a verified licence is expired or close to it."""
    credential = (
        ProfessionalCredential.objects.filter(
            user=user, status=ProfessionalCredential.Status.VERIFIED, valid_until__isnull=False
        )
        .order_by("valid_until")
        .first()
    )
    if credential is None:
        return ""
    seconds_left = (credential.valid_until - timezone.now()).total_seconds()
    if seconds_left <= 0:
        return f"{credential.title} has expired — renew it to keep it on your record."
    # Rounded up: a licence that runs out tomorrow morning has one day left.
    days = math.ceil(seconds_left / 86_400)
    if days > EXPIRY_WARNING_DAYS:
        return ""
    unit = "day" if days == 1 else "days"
    return f"{credential.title} expires in {days} {unit} — renew it to keep it on your record."


# ------------------------------------------------------------------ ladder


def verification_ladder(profile) -> dict:
    user = profile.user
    has_record = _has_record(user)
    skills = _skills_count(profile)
    connections = Connection.objects.filter(Q(user_one=user) | Q(user_two=user)).count()
    confirmation = _third_party_confirmation(user)
    run = longest_daily_run(user)

    rungs = [
        {
            "key": "email_confirmed",
            "band": "you",
            "label": "Email confirmed",
            "hint": "Sign in with an email link.",
            "done": user.is_email_verified,
            "attested_by": "Your email provider",
            "action": None,
            "detail": user.email if user.is_email_verified else "",
        },
        {
            "key": "who_you_are",
            "band": "you",
            "label": "Who you are",
            "hint": "Your name, a one-line headline, and the city and country you work from.",
            "done": _who_you_are(profile),
            "attested_by": "You",
            "action": "identity",
            "detail": f"/p/{profile.handle}" if profile.handle else "",
        },
        {
            "key": "face_and_story",
            "band": "you",
            "label": "Face and story",
            "hint": f"A photo and two or three lines about your work ({MIN_BIO_CHARS}+ characters).",
            "done": _face_and_story(profile),
            "attested_by": "You",
            "action": "identity" if not profile.profile_picture else "about",
            "detail": "",
        },
        {
            "key": "record_started",
            "band": "you",
            "label": "Record started",
            # Skills are picked by hand here: the LinkedIn import brings roles
            # and degrees, never the skill list (accounts/linkedin_import.py).
            "hint": f"One role or degree, and at least {MIN_SKILLS} skills. "
            "Importing from LinkedIn brings the roles.",
            "done": has_record and skills >= MIN_SKILLS,
            "attested_by": "You",
            "action": "experience" if not has_record else "skills",
            "detail": "",
        },
        {
            "key": "first_connection",
            "band": "others",
            "label": "First connection",
            "hint": "Someone who knows your work accepts your request — or sends you one.",
            "done": connections > 0,
            "attested_by": "Another member",
            "action": "discover",
            "detail": f"{connections} connection{'s' if connections != 1 else ''}" if connections else "",
        },
        {
            "key": "confirmed",
            "band": "others",
            "label": "Confirmed by someone else",
            "hint": "An organisation confirms your role, a registry certificate proves you "
            "founded it, a startup confirms your investment, or a licence is verified.",
            "done": confirmation is not None,
            "attested_by": confirmation[0] if confirmation else "An organisation or issuing body",
            "action": "experience",
            "detail": confirmation[1] if confirmation else "",
            "warning": _credential_warning(user),
        },
        {
            "key": "beedero_verified",
            "band": "others",
            "label": "Verified by Beedero",
            "hint": "We review the record above and confirm it holds up.",
            "done": profile.is_verified,
            "attested_by": "Beedero",
            "action": None,
            "detail": "",
        },
        {
            "key": "daily_week",
            "band": "record",
            "label": "A week on the record",
            "hint": f"Post every day for {DAILY_STREAK_DAYS} days in a row.",
            "done": run >= DAILY_STREAK_DAYS,
            "attested_by": "Your record",
            "action": "post",
            "detail": "",
            "progress": min(run, DAILY_STREAK_DAYS),
        },
    ]
    for rung in rungs:
        rung.setdefault("progress", None)
        rung.setdefault("warning", "")

    done = sum(1 for rung in rungs if rung["done"])
    unlock_missing = [r["key"] for r in rungs if r["key"] in UNLOCK_KEYS and not r["done"]]
    return {
        "rungs": rungs,
        "done_count": done,
        "total_count": len(rungs),
        # Floored, so it never overstates: 12, 25, 37, 50 … and exactly 50 at the gate.
        "percent": 100 * done // len(rungs),
        # True exactly when is_unlocked(profile) is — the same four checks.
        "unlocked": not unlock_missing,
        "unlock_missing": unlock_missing,
        "next": next((rung["key"] for rung in rungs if not rung["done"]), None),
        # Rungs 5–8 can be climbed in any order, so the level is the count.
        "level": done,
    }


def mark_unlock(profile, ladder: dict) -> None:
    """First time the gate opens: stamp it (time-to-unlock is the activation
    metric) and tell the person once. Called from the vitality endpoint, which
    the profile page reloads after every save."""
    if not ladder["unlocked"] or profile.discoverable_since:
        return
    from notifications.models import Notification
    from notifications.services import notify

    profile.discoverable_since = timezone.now()
    profile.save(update_fields=["discoverable_since"])
    notify(
        profile.user,
        kind=Notification.Kind.MILESTONE,
        aggregate_key=f"unlocked:{profile.user_id}",
        title="You're in Discover",
        body="People can now find you, and you can send connection requests.",
        link="/discovery",
    )
