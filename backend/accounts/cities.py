"""City normalization for the local-density features (doc
`beedero-features-onfound-analise.md` §1.1).

The city is *declared*, never derived from IP — same rule as every other
profile field, and the one the analysis doc calls out explicitly.

Free text is what people will actually type, but free text is also what
breaks the feature: "Lisboa", "lisbon", "Lisboa, Portugal" and "LISBON"
are one city to a human and four to a `GROUP BY`. A count that says
"47 builders in your city" when the real number is 191 is worse than no
count at all, so every profile stores two values: `city` exactly as typed
(what we show back) and `city_key` (what we count and filter on).
"""

import re
import unicodedata

MAX_CITY_LENGTH = 80

# Seed aliases, Portugal first — extend as markets open rather than trying
# to be a gazetteer. Anything not listed normalizes to itself, which is the
# right default: two people who both type "Braga" already match.
ALIASES = {
    "lisboa": "lisbon",
    "lisbonne": "lisbon",
    "lissabon": "lisbon",
    "oporto": "porto",
    "coimbra": "coimbra",
    "madri": "madrid",
    "sevilla": "seville",
    "barcelone": "barcelona",
    "milano": "milan",
    "roma": "rome",
    "firenze": "florence",
    "napoli": "naples",
    "atenas": "athens",
    "athina": "athens",
}

_PUNCTUATION = re.compile(r"[^\w\s-]", re.UNICODE)
_WHITESPACE = re.compile(r"[\s_-]+")


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def normalize_city(value: str) -> str:
    """The matching key for a declared city. Empty string when there's
    nothing usable — callers treat that as "no city set", never as a city
    named ""."""
    if not value:
        return ""

    # "Lisboa, Portugal" and "Porto, PT" are what people type when a field
    # doesn't tell them otherwise. The part before the first comma is the
    # city; everything after it is the context they added for us.
    head = str(value).split(",")[0]

    cleaned = _strip_accents(head).lower()
    cleaned = _PUNCTUATION.sub(" ", cleaned)
    cleaned = _WHITESPACE.sub(" ", cleaned).strip()
    if not cleaned:
        return ""

    cleaned = ALIASES.get(cleaned, cleaned)
    return cleaned[:MAX_CITY_LENGTH]


def clean_city(value: str) -> str:
    """The display form: trimmed and length-capped, otherwise exactly what
    the person typed. We normalize for matching, not for correcting people
    — someone who writes "Lisboa" keeps seeing "Lisboa" on their profile."""
    if not value:
        return ""
    return _WHITESPACE.sub(" ", str(value).strip())[:MAX_CITY_LENGTH]
