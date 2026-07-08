import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="rl@example.com", email="rl@example.com", password="correct-horse-1")


@pytest.mark.django_db
def test_login_rate_limited_by_ip(api, user):
    for _ in range(20):
        api.post("/api/auth/token/", {"email": user.email, "password": "wrong"}, format="json")
    res = api.post("/api/auth/token/", {"email": user.email, "password": "wrong"}, format="json")
    assert res.status_code == 429


@pytest.mark.django_db
def test_login_succeeds_under_the_limit(api, user):
    res = api.post("/api/auth/token/", {"email": user.email, "password": "correct-horse-1"}, format="json")
    assert res.status_code == 200
    assert "access" in res.data


@pytest.mark.django_db
def test_forgot_password_rate_limited_by_ip(api, user):
    for _ in range(10):
        api.post("/api/auth/forgot-password/", {"email": user.email}, format="json")
    res = api.post("/api/auth/forgot-password/", {"email": user.email}, format="json")
    assert res.status_code == 429


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api, user):
    login = api.post(
        "/api/auth/token/", {"email": user.email, "password": "correct-horse-1"}, format="json"
    )
    access, refresh = login.data["access"], login.data["refresh"]

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    res = api.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert res.status_code == 204

    # The refresh token that was just blacklisted must now be rejected.
    res = api.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert res.status_code == 401


@pytest.mark.django_db
def test_logout_is_idempotent_on_already_invalid_token(api, user):
    login = api.post(
        "/api/auth/token/", {"email": user.email, "password": "correct-horse-1"}, format="json"
    )
    access = login.data["access"]

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    res = api.post("/api/auth/logout/", {"refresh": "not-a-real-token"}, format="json")
    assert res.status_code == 204
