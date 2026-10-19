"""Shared calendar bounds for user-entered biographical / historical dates."""

from __future__ import annotations

from datetime import date

from rest_framework import serializers

DATE_YEAR_MIN = 1950


def assert_date_in_bounds(value: date | None, *, allow_future: bool = False) -> date | None:
    """Raise a DRF ValidationError when `value` is before 1950 or (optionally) after today."""
    if value is None:
        return value
    if value.year < DATE_YEAR_MIN:
        raise serializers.ValidationError(
            f"Date must be on or after 1 January {DATE_YEAR_MIN}."
        )
    if not allow_future and value > date.today():
        raise serializers.ValidationError("Date cannot be in the future.")
    return value


class BoundedDateField(serializers.DateField):
    """DateField that rejects years before 1950 and (by default) future days."""

    def __init__(self, *args, allow_future: bool = False, **kwargs):
        self.allow_future = allow_future
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        return assert_date_in_bounds(value, allow_future=self.allow_future)
