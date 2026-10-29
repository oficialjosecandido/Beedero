"""Handing over the Nexus: `ensure_nexus_admins` is what makes the founding
admin an admin, on a database where Firebase has set nobody's `is_staff`."""

import pytest
from django.core.management import call_command

from accounts.models import User
from beedero.admin_access import FIRST_ADMIN_EMAIL, KPI_ADMIN_EMAILS
from nexus.access import ADMIN, nexus_role
from nexus.management.commands.ensure_nexus_admins import admin_emails


def test_the_founding_admin_is_named_and_comes_first():
    assert FIRST_ADMIN_EMAIL == "josevcandido@gmail.com"
    assert FIRST_ADMIN_EMAIL in KPI_ADMIN_EMAILS
    assert admin_emails()[0] == "josevcandido@gmail.com"


@pytest.mark.django_db
def test_it_promotes_the_founding_admin(monkeypatch, make_user):
    monkeypatch.undo()  # the real allowlist, not conftest's test address
    user = make_user("boss", email=FIRST_ADMIN_EMAIL)
    assert nexus_role(user) is None  # on the list, but not staff yet

    call_command("ensure_nexus_admins")

    user.refresh_from_db()
    assert user.is_staff
    assert nexus_role(user) == ADMIN


@pytest.mark.django_db
def test_a_differently_cased_address_is_the_same_admin(monkeypatch, make_user):
    monkeypatch.undo()
    user = make_user("boss", email=FIRST_ADMIN_EMAIL.upper())
    call_command("ensure_nexus_admins")
    user.refresh_from_db()
    assert user.is_staff


@pytest.mark.django_db
def test_it_creates_nobody_and_runs_twice_cleanly(monkeypatch, make_user):
    """Safe on every container start, including before the owner's first
    sign-in — a `User` with no Firebase uid could never sign in anyway."""
    monkeypatch.undo()
    call_command("ensure_nexus_admins")
    assert not User.objects.filter(email__in=KPI_ADMIN_EMAILS).exists()

    user = make_user("boss", email=FIRST_ADMIN_EMAIL)
    call_command("ensure_nexus_admins")
    call_command("ensure_nexus_admins")
    user.refresh_from_db()
    assert user.is_staff


@pytest.mark.django_db
def test_it_leaves_everyone_else_alone(monkeypatch, make_user):
    monkeypatch.undo()
    other = make_user("ana")
    call_command("ensure_nexus_admins")
    other.refresh_from_db()
    assert not other.is_staff
    assert nexus_role(other) is None
