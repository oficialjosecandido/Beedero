from datetime import date, timedelta

import pytest
from rest_framework import serializers

from beedero.date_bounds import DATE_YEAR_MIN, BoundedDateField, assert_date_in_bounds


def test_assert_date_in_bounds_rejects_pre_1950():
    with pytest.raises(serializers.ValidationError):
        assert_date_in_bounds(date(DATE_YEAR_MIN - 1, 12, 31))


def test_assert_date_in_bounds_rejects_future():
    with pytest.raises(serializers.ValidationError):
        assert_date_in_bounds(date.today() + timedelta(days=1))


def test_assert_date_in_bounds_allows_today_and_1950():
    assert assert_date_in_bounds(date(DATE_YEAR_MIN, 1, 1)) == date(DATE_YEAR_MIN, 1, 1)
    assert assert_date_in_bounds(date.today()) == date.today()


def test_bounded_date_field_parses_and_rejects():
    field = BoundedDateField()
    assert field.run_validation("2000-06-15") == date(2000, 6, 15)
    with pytest.raises(serializers.ValidationError):
        field.run_validation("0004-01-01")
