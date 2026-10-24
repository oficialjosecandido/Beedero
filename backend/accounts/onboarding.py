"""The person's three-step onboarding — doc §6.3, with §6.4's routing.

    1. Quem és: nome, handle, cidade, frase curta sobre ti.
    2. O que te traz cá (escolha múltipla, privada).
    3. O teu percurso: importar o PDF ou adicionar à mão (pode saltar-se).

    No fim, sugestões para seguir (5 pessoas/orgs da mesma cidade e área)
    para o feed não aparecer vazio.

Three things are worth stating up front, because they are the decisions a
reader will question:

**The handle is editable here and nowhere else.** `InvestorProfile.handle` is
derived from the name and then frozen (accounts/handles.py), and
`InvestorProfileSerializer` lists it read-only. That is right for an address
that has been shared, and wrong for one the person has never seen: §6.3 puts
the handle in step 1, so this module lets them change it while it is still
nobody's address — once, before onboarding is marked done.

**Nothing here is a gate.** `onboarding_completed_at` records that somebody has
been *through* the steps, including by skipping step 3 (§6.3) or by walking
away from the whole thing. Someone who arrived to apply for a job keeps going
to the job (§3.5): the feed is what sends people here, because an empty feed is
the problem the suggestions exist to solve.

**Suggestions put orgs before people.** Both are asked for, but only a followed
org fills a feed today — a connection request has to be accepted first
(connections/services.py), so a screen of five people can leave the feed just
as empty as before. Orgs first, people after, and the ordering is the whole
reason this is not a single mixed query.
"""

from django.db import transaction
from django.utils import timezone

from beedero.handles import compact_handle_base, public_id_taken, valid_handle

from .cities import clean_city
from .intents import clean_intents, primary_intent
from .minimum_profile import MAX_CITY, MAX_HEADLINE, MAX_NAME
from .models import InvestorProfile

SUGGESTION_LIMIT = 5
# A bounded candidate set, ranked in Python: "mesma área" is an overlap between
# two JSON skill lists, and doing that in SQL means either a Postgres-only
# operator or a LIKE per skill. Reading a few dozen rows from one city is
# cheaper than both, and this runs once per person.
_CANDIDATE_CAP = 60


class OnboardingError(ValueError):
    """A step could not be saved. The message is shown to the person."""

    def __init__(self, message: str, field: str = ""):
        super().__init__(message)
        self.field = field


def _profile(user) -> InvestorProfile:
    profile, _ = InvestorProfile.objects.get_or_create(user=user)
    return profile


def state(user) -> dict:
    """Everything the onboarding screens need, in one request."""
    from .ladder import gate_state  # accounts.models imports this module

    profile = _profile(user)
    intents = clean_intents(profile.intents)
    return {
        "completed": profile.onboarding_completed_at is not None,
        "completed_at": profile.onboarding_completed_at,
        # Step 1. `handle_locked` is what the form uses to decide whether to
        # offer the field at all: after onboarding it is an address, not a
        # choice.
        "full_name": profile.full_name,
        "handle": profile.handle or "",
        "handle_locked": profile.onboarding_completed_at is not None,
        "handle_suggestion": _handle_suggestion(profile),
        "city": profile.city,
        "headline": profile.headline,
        # Step 2 — private, and only ever sent back to the person themselves.
        "intents": intents,
        "primary_intent": primary_intent(intents),
        # Rungs 1–4 of the ladder (accounts/ladder.py). The last screen sends
        # people who are still short of the gate to their profile instead of
        # the feed: nothing in Discover would work for them yet.
        "can_connect": gate_state(user)["unlocked"],
    }


def _handle_suggestion(profile) -> str:
    """What the handle field is prefilled with before they have one.

    The same derivation the automatic path uses, so the suggestion a person
    accepts is the handle they would have been given anyway.
    """
    if profile.handle:
        return profile.handle
    base = compact_handle_base(profile.full_name)
    if not valid_handle(base) or public_id_taken(base, exclude_profile_pk=profile.pk):
        return ""
    return base


def clean_handle(value: str, *, profile) -> str:
    """Validate a handle the person typed. Returns "" for "leave it alone"."""
    candidate = (value or "").strip().lower().lstrip("@")
    if not candidate:
        return ""
    if candidate == profile.handle:
        return ""
    if not valid_handle(candidate):
        raise OnboardingError(
            "A handle can only use lowercase letters and numbers.", field="handle"
        )
    # One namespace with organizations (beedero/handles.py), so this also
    # refuses a handle that an org already answers to.
    if public_id_taken(candidate, exclude_profile_pk=profile.pk):
        raise OnboardingError("That handle is taken.", field="handle")
    return candidate


@transaction.atomic
def save_identity(user, *, full_name: str = "", handle: str = "", city: str = "", headline: str = "") -> dict:
    """Step 1. Name and city are required; the headline and handle are not."""
    profile = _profile(user)

    name = (full_name or "").strip()[:MAX_NAME]
    if not name:
        raise OnboardingError("Tell us your name.", field="full_name")
    # The serializer refuses to change a name that is already set, and for the
    # same reason: it is what every confirmed affiliation and verification was
    # issued against. Onboarding does not get an exception.
    if profile.full_name and name != profile.full_name:
        name = profile.full_name

    city_value = clean_city((city or "").strip()[:MAX_CITY])
    if not city_value:
        # §6.1: declared, never inferred from the IP — so a blank one cannot be
        # quietly filled in, and asking is the only way to get it.
        raise OnboardingError("Tell us your base city.", field="city")

    new_handle = clean_handle(handle, profile=profile)
    if new_handle and profile.onboarding_completed_at is not None:
        raise OnboardingError("Your handle can no longer be changed.", field="handle")

    profile.full_name = name
    profile.city = city_value
    profile.headline = (headline or "").strip()[:MAX_HEADLINE]
    fields = ["full_name", "city", "headline"]
    if new_handle:
        profile.handle = new_handle
        fields.append("handle")
    profile.save(update_fields=fields)

    # Nobody should leave step 1 without a public address: the name is set now,
    # which is the only thing the automatic derivation was ever waiting for.
    if profile.ensure_handle():
        profile.refresh_from_db(fields=["handle"])

    return state(user)


def save_intents(user, values) -> dict:
    """Step 2. An empty list is a valid answer — the question is skippable."""
    profile = _profile(user)
    profile.intents = clean_intents(values)
    profile.save(update_fields=["intents"])
    return state(user)


def complete(user) -> dict:
    """Mark the flow as seen. Idempotent: the first time through is the one
    that counts, and re-running the steps later must not restart the clock."""
    profile = _profile(user)
    if profile.onboarding_completed_at is None:
        profile.onboarding_completed_at = timezone.now()
        profile.save(update_fields=["onboarding_completed_at"])
    return state(user)


# ---------------------------------------------------------------- suggestions


def _org_suggestions(user, *, city_key: str, limit: int):
    """LIVE orgs with somebody from this person's city on the team.

    Organizations have no city of their own — `geo` is an HQ region for
    discovery filters ("PT", "remote"), not a city — so "mesma cidade" for an
    org means its members declared this city. That is also the more useful
    claim: it is a company with people the person could actually meet.
    """
    from orgs.models import OrgFollow, Organization

    followed = OrgFollow.objects.filter(user=user).values_list("org_id", flat=True)
    qs = Organization.objects.filter(status=Organization.Status.LIVE).exclude(id__in=followed)
    if city_key:
        qs = qs.filter(members__user__investorprofile__city_key=city_key)
    # .distinct() because the members__ join returns one row per matching
    # teammate, and an org with three people in Lisbon is still one suggestion.
    return list(qs.distinct().order_by("-is_verified", "-created_at")[:limit])


def _people_suggestions(user, *, city_key: str, skills: set[str], limit: int):
    """Profiles in the same city, the closest areas first.

    Excludes anyone already connected or with a request in either direction:
    suggesting somebody a "Connect" button cannot act on is a dead row.
    """
    from connections.models import ConnectionRequest
    from connections.services import connected_user_ids

    if not city_key:
        return []

    blocked = set(connected_user_ids(user)) | {user.id}
    blocked |= set(
        ConnectionRequest.objects.filter(
            status=ConnectionRequest.Status.PENDING
        )
        .filter(requester=user)
        .values_list("recipient_id", flat=True)
    )
    blocked |= set(
        ConnectionRequest.objects.filter(
            status=ConnectionRequest.Status.PENDING, recipient=user
        ).values_list("requester_id", flat=True)
    )

    from .ladder import discoverable

    candidates = (
        discoverable(InvestorProfile.objects.filter(city_key=city_key))
        .exclude(user_id__in=blocked)
        .exclude(handle="")
        .exclude(handle__isnull=True)
        .exclude(full_name="")
        .select_related("user")
        .order_by("-is_verified", "-id")[:_CANDIDATE_CAP]
    )

    def rank(profile):
        other = {
            skill.strip().lower()
            for skill in (profile.skills or [])
            if isinstance(skill, str) and skill.strip()
        }
        # Shared skills first (§6.3's "mesma área"), verified next, and newest
        # last so the list is stable rather than random when nothing overlaps.
        return (-len(skills & other), not profile.is_verified, -profile.id)

    return sorted(candidates, key=rank)[:limit]


def suggestions(user, *, limit: int = SUGGESTION_LIMIT) -> dict:
    """§6.3's closing screen: five orgs and people worth following.

    Orgs fill the first slots for the reason in this module's docstring. When
    the city yields too few, the gap is filled with verified orgs from
    anywhere: the person asked for a feed, and "nothing near you yet" is a true
    statement that still leaves them with an empty one.
    """
    profile = _profile(user)
    city_key = profile.city_key
    skills = {
        skill.strip().lower()
        for skill in (profile.skills or [])
        if isinstance(skill, str) and skill.strip()
    }

    # Only a declared city can produce a local suggestion. Without one every
    # row is fallback, and the screen must not claim otherwise — §6.1 refuses
    # to guess a city, so this refuses to imply one.
    local_orgs = _org_suggestions(user, city_key=city_key, limit=limit) if city_key else []
    # Leave at least two slots for people when there are people to put in them,
    # so a city with a busy startup scene does not crowd them out entirely.
    people = _people_suggestions(user, city_key=city_key, skills=skills, limit=limit)
    org_slots = limit - min(len(people), 2) if people else limit
    local_orgs = local_orgs[:org_slots]

    filler: list = []
    if len(local_orgs) + len(people) < limit:
        seen = {org.id for org in local_orgs}
        filler = [
            org
            for org in _org_suggestions(user, city_key="", limit=limit)
            if org.id not in seen
        ][: limit - len(local_orgs) - len(people)]

    people = people[: max(0, limit - len(local_orgs) - len(filler))]

    return {
        "city": profile.city,
        # Whether this person's city has a scene yet, which the screen needs in
        # order to say so rather than implying one.
        "is_local": bool(city_key) and bool(local_orgs or people),
        # Marked per entry, not just in the total: a card that says "in Lisbon"
        # about a company with nobody in Lisbon is the kind of small lie that
        # makes the rest of the screen not worth believing.
        "orgs": [(org, True) for org in local_orgs] + [(org, False) for org in filler],
        "people": people,
    }
