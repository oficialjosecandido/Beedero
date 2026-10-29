import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User

ADMIN_EMAIL = "admin@beedero.test"


@pytest.fixture(autouse=True)
def _admin_allowlist(monkeypatch):
    """Tests use their own admin address, not the real allowlist."""
    monkeypatch.setattr("nexus.access.KPI_ADMIN_EMAILS", {ADMIN_EMAIL})


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def make_user(db):
    def make(username, *, email=None, staff=False, verified=True, **fields):
        user = User.objects.create_user(
            username=username, email=email or f"{username}@example.com", password="x", is_staff=staff, **fields
        )
        if verified:
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
        return user

    return make


@pytest.fixture
def admin(make_user):
    return make_user("boss", email=ADMIN_EMAIL, staff=True)


@pytest.fixture
def staff(make_user):
    return make_user("mod", email="mod@beedero.test", staff=True)


@pytest.fixture
def as_admin(api, admin):
    api.force_authenticate(admin)
    return api


@pytest.fixture
def as_staff(api, staff):
    api.force_authenticate(staff)
    return api
