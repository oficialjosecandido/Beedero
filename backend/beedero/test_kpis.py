from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import User


@pytest.fixture(autouse=True)
def _no_shared_page_cache(settings):
    # kpis_view is wrapped in cache_page; keep each test's render its own.
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    # The admin template links static files; tests run without collectstatic.
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


def _cards(response):
    return {c["label"]: c["value"] for c in response.context["cards"]}


@pytest.mark.django_db
def test_activity_cards_use_last_seen_and_skip_internal_accounts():
    now = timezone.now()
    admin = User.objects.create_user(
        username="admin", email="josevcandido@gmail.com", password="x", is_staff=True
    )
    old = now - timedelta(days=30)

    # Joined a month ago, back today: active AND returning.
    User.objects.create_user(username="r", password="x", date_joined=old, last_seen_at=now)
    # Joined today: active, not returning.
    User.objects.create_user(username="n", password="x", last_seen_at=now)
    # Joined a month ago, never came back.
    User.objects.create_user(username="g", password="x", date_joined=old)
    # Test account, very active: must not count anywhere.
    User.objects.create_user(
        username="t", password="x", date_joined=old, last_seen_at=now, is_internal=True
    )
    # last_login alone (an /admin sign-in) no longer counts as activity.
    User.objects.create_user(username="l", password="x", date_joined=old, last_login=now)

    client = Client()
    client.force_login(admin)
    res = client.get("/admin/kpis/")

    assert res.status_code == 200
    cards = _cards(res)
    assert cards["Users"] == 4
    assert cards["Active people"] == 2
    assert cards["Active (7d)"] == 2
    assert cards["Returning (7d)"] == 1
    assert "Logins" not in cards
