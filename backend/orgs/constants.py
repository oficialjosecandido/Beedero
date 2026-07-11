"""Mapping of the profile's three section natures (doc §1)."""

from django.db import models


class Nature(models.TextChoices):
    IDENTITY = "identity"
    ACTIVITY = "activity"
    FUNDRAISE = "fundraise"


class SectionKind(models.TextChoices):
    # Identity — tends to be public, always exists
    ABOUT = "about"
    TEAM = "team"
    PRODUCTS = "products"
    MARKET_THESIS = "market_thesis"
    LINKS = "links"
    # Certified financials, written by credibility.services on nivel-3
    # approval (annual accounts review) — restricted, but NOT one of the
    # FUNDRAISE_KINDS below: a round opening/closing must not touch it, and
    # it must survive independently of whether the org ever raises at all.
    CERTIFIED_FINANCIALS = "certified_financials"
    # Activity — public, time-based feed, always exists
    NEWS = "news"
    MILESTONES = "milestones"
    EVENTS = "events"
    AWARDS = "awards"
    PRESS = "press"
    # Fundraise — restricted, only exists during an active round
    VALUATION = "valuation"
    ASK = "ask"
    USE_OF_FUNDS = "use_of_funds"
    FINANCIALS = "financials"
    DATA_ROOM = "dataroom"
    CAP_TABLE = "cap_table"


NATURE_BY_KIND = {
    SectionKind.ABOUT: Nature.IDENTITY,
    SectionKind.TEAM: Nature.IDENTITY,
    SectionKind.PRODUCTS: Nature.IDENTITY,
    SectionKind.MARKET_THESIS: Nature.IDENTITY,
    SectionKind.LINKS: Nature.IDENTITY,
    SectionKind.CERTIFIED_FINANCIALS: Nature.IDENTITY,
    SectionKind.NEWS: Nature.ACTIVITY,
    SectionKind.MILESTONES: Nature.ACTIVITY,
    SectionKind.EVENTS: Nature.ACTIVITY,
    SectionKind.AWARDS: Nature.ACTIVITY,
    SectionKind.PRESS: Nature.ACTIVITY,
    SectionKind.VALUATION: Nature.FUNDRAISE,
    SectionKind.ASK: Nature.FUNDRAISE,
    SectionKind.USE_OF_FUNDS: Nature.FUNDRAISE,
    SectionKind.FINANCIALS: Nature.FUNDRAISE,
    SectionKind.DATA_ROOM: Nature.FUNDRAISE,
    SectionKind.CAP_TABLE: Nature.FUNDRAISE,
}

# Kinds created automatically when the Organization is created (always exist).
ALWAYS_ON_KINDS = [
    SectionKind.ABOUT,
    SectionKind.TEAM,
    SectionKind.PRODUCTS,
    SectionKind.MARKET_THESIS,
    SectionKind.LINKS,
    SectionKind.NEWS,
    SectionKind.MILESTONES,
    SectionKind.EVENTS,
    SectionKind.AWARDS,
    SectionKind.PRESS,
]

# Kinds created only when a round opens, archived when it closes.
FUNDRAISE_KINDS = [
    SectionKind.VALUATION,
    SectionKind.ASK,
    SectionKind.USE_OF_FUNDS,
    SectionKind.FINANCIALS,
    SectionKind.DATA_ROOM,
    SectionKind.CAP_TABLE,
]

ACTIVITY_KINDS = [
    SectionKind.NEWS,
    SectionKind.MILESTONES,
    SectionKind.EVENTS,
    SectionKind.AWARDS,
    SectionKind.PRESS,
]

DEFAULT_VISIBILITY_BY_NATURE = {
    Nature.IDENTITY: "public",
    Nature.ACTIVITY: "public",
    Nature.FUNDRAISE: "restricted",
}
