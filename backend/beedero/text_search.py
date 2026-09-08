"""Accent- and case-insensitive text matching for Postgres/SQLite."""

import unicodedata

from django.db.models import CharField, Func, Value
from django.db.models.functions import Lower


# Portuguese / Latin accents commonly used in Beedero names.
_ACCENT_FROM = "áàãâäÁÀÃÂÄéèêëÉÈÊËíìîïÍÌÎÏóòõôöÓÒÕÔÖúùûüÚÙÛÜçÇñÑ"
_ACCENT_TO = "aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN"


class StripAccents(Func):
    """SQL translate() — strips accents without requiring the unaccent extension."""

    function = "translate"
    output_field = CharField()

    def __init__(self, expression, **extra):
        super().__init__(
            expression,
            Value(_ACCENT_FROM),
            Value(_ACCENT_TO),
            **extra,
        )


def fold_text(value: str) -> str:
    """Python-side fold for the query string (case + accents)."""
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()


def searchable_key(field_name: str):
    """Annotatable expression: lower(translate(field))."""
    return Lower(StripAccents(field_name))
