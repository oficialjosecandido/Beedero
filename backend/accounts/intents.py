"""What brought somebody to Beedero — doc §6.3 step 2, used by §6.4.

The doc is explicit about what these are and are not:

    "O que te traz cá (escolha múltipla, privada — são capacidades, não
    rótulos públicos)"

and again in §9's guards: "Intenções do onboarding são capacidades privadas,
nunca rótulos no perfil público." So an intent decides what the person is shown
first and never appears on `/p/<handle>`, in a badge, in search or in any
discovery filter. `InvestorProfileSerializer` lists its fields explicitly and
`accounts/public_views.py` builds the public payload by hand, which is what
keeps that true by construction rather than by vigilance.

A closed vocabulary, not free text: these are read by code that routes people
(§6.4), so an unrecognised value would silently mean "no intent at all".
"""

from django.db import models

MAX_INTENTS = 5


class Intent(models.TextChoices):
    """§6.3's five options, in the order §6.4's table lists them.

    The order is load-bearing: it is also the priority used to pick a first
    screen for somebody who chose several, so a person who is both looking for
    work and curious about the ecosystem gets the job board rather than the
    feed. EXPLORE is last because it is the weakest signal — it is what
    somebody picks when none of the others fit.
    """

    JOB = "job", "Looking for a job"
    COFOUNDER = "cofounder", "Looking for a co-founder"
    INVEST = "invest", "Investing"
    BUILD = "build", "Building my startup"
    EXPLORE = "explore", "Getting to know the ecosystem"


VALID_INTENTS = frozenset(Intent.values)

# Vocabulary order, so a stored list reads the same way whatever order the
# checkboxes were ticked in — and so the first entry is always the one §6.4
# routes on.
_ORDER = {value: index for index, value in enumerate(Intent.values)}


def clean_intents(values) -> list[str]:
    """Normalise whatever the client sent into a stored list.

    Unknown values are dropped rather than rejected: a client sending a sixth
    option is a client that is out of date, and the four it got right are still
    worth keeping. A wholly unrecognised list comes back empty, which the
    caller treats as "they skipped the question".
    """
    if not isinstance(values, (list, tuple, set)):
        return []

    seen = {
        value.strip()
        for value in values
        if isinstance(value, str) and value.strip() in VALID_INTENTS
    }
    return sorted(seen, key=lambda value: _ORDER[value])[:MAX_INTENTS]


def primary_intent(values) -> str:
    """The one intent a first screen is chosen from, or "" if there is none.

    `clean_intents` already sorted by vocabulary order, so this is just the
    first entry — but callers read better for saying what they mean, and the
    priority rule lives in one place if it ever stops being "first".
    """
    cleaned = clean_intents(values)
    return cleaned[0] if cleaned else ""
