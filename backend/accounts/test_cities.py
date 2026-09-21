import pytest

from accounts.cities import MAX_CITY_LENGTH, clean_city, normalize_city
from accounts.models import InvestorProfile, User


@pytest.mark.parametrize(
    "typed,expected",
    [
        ("Lisboa", "lisbon"),
        ("lisbon", "lisbon"),
        ("LISBOA", "lisbon"),
        ("  Lisboa  ", "lisbon"),
        ("Lisboa, Portugal", "lisbon"),
        ("Porto, PT", "porto"),
        ("Oporto", "porto"),
        ("São Paulo", "sao paulo"),
        ("Sao  Paulo", "sao paulo"),
        ("New York", "new york"),
        ("", ""),
        ("   ", ""),
        (",Portugal", ""),
        ("!!!", ""),
    ],
)
def test_normalize_city(typed, expected):
    assert normalize_city(typed) == expected


def test_the_same_city_typed_four_ways_is_one_key():
    """The whole point of the field: a density count that fragments is worse
    than no count at all."""
    typed = ["Lisboa", "lisbon", "LISBOA ", "Lisboa, Portugal"]
    assert len({normalize_city(v) for v in typed}) == 1


def test_clean_city_keeps_what_the_person_typed():
    assert clean_city("  Lisboa,  Portugal ") == "Lisboa, Portugal"


def test_clean_city_caps_length():
    assert len(clean_city("x" * 200)) == MAX_CITY_LENGTH


@pytest.mark.django_db
def test_saving_a_profile_derives_the_city_key():
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    profile = InvestorProfile.objects.create(user=user, full_name="Ada", city="Lisboa")
    assert profile.city == "Lisboa"
    assert profile.city_key == "lisbon"


@pytest.mark.django_db
def test_update_fields_city_also_writes_the_key():
    """A partial save that names only `city` must not leave the key stale —
    otherwise the profile says Porto and the search still says Lisbon."""
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    profile = InvestorProfile.objects.create(user=user, full_name="Ada", city="Lisboa")

    profile.city = "Porto"
    profile.save(update_fields=["city"])

    profile.refresh_from_db()
    assert profile.city_key == "porto"


@pytest.mark.django_db
def test_clearing_the_city_clears_the_key():
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    profile = InvestorProfile.objects.create(user=user, full_name="Ada", city="Lisboa")
    profile.city = ""
    profile.save(update_fields=["city"])
    profile.refresh_from_db()
    assert profile.city_key == ""
