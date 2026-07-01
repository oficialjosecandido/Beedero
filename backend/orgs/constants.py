"""Mapeamento das três naturezas de secção do perfil (doc §1)."""

from django.db import models


class Nature(models.TextChoices):
    IDENTITY = "identity"
    ACTIVITY = "activity"
    FUNDRAISE = "fundraise"


class SectionKind(models.TextChoices):
    # Identidade — tendencialmente pública, existe sempre
    ABOUT = "about"
    TEAM = "team"
    PRODUCTS = "products"
    MARKET_THESIS = "market_thesis"
    # Atividade — pública, feed temporal, existe sempre
    NEWS = "news"
    MILESTONES = "milestones"
    EVENTS = "events"
    AWARDS = "awards"
    PRESS = "press"
    # Fundraise — restrito, só existe quando em ronda ativa
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

# Kinds criados automaticamente ao criar a Organization (existem sempre).
ALWAYS_ON_KINDS = [
    SectionKind.ABOUT,
    SectionKind.TEAM,
    SectionKind.PRODUCTS,
    SectionKind.MARKET_THESIS,
    SectionKind.NEWS,
    SectionKind.MILESTONES,
    SectionKind.EVENTS,
    SectionKind.AWARDS,
    SectionKind.PRESS,
]

# Kinds criados só ao abrir ronda, arquivados ao fechar.
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
