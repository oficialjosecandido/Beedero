from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import InvestorPost, InvestorProfile, User
from accounts.tokens import email_verification_token_generator


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


@pytest.mark.django_db
def test_register_creates_user_and_returns_debug_verify_url(api, settings):
    settings.DEBUG = True
    res = api.post(
        "/api/auth/register/",
        {"email": "new@example.com", "password": "correct-horse-1", "confirm_password": "correct-horse-1"},
        format="json",
    )
    assert res.status_code == 201
    user = User.objects.get(email="new@example.com")
    assert not user.is_email_verified
    assert "verify_email_url" in res.data


@pytest.mark.django_db
def test_register_rejects_mismatched_passwords(api, db):
    res = api.post(
        "/api/auth/register/",
        {"email": "new@example.com", "password": "correct-horse-1", "confirm_password": "something-else-1"},
        format="json",
    )
    assert res.status_code == 400
    assert not User.objects.filter(email="new@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api, user):
    res = api.post(
        "/api/auth/register/",
        {"email": user.email, "password": "correct-horse-1", "confirm_password": "correct-horse-1"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_verify_email_confirm_marks_user_verified(api, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token_generator.make_token(user)
    res = api.post("/api/auth/verify-email/confirm/", {"uid": uid, "token": token}, format="json")
    assert res.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified


@pytest.mark.django_db
def test_verify_email_confirm_rejects_bad_token(api, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    res = api.post("/api/auth/verify-email/confirm/", {"uid": uid, "token": "garbage"}, format="json")
    assert res.status_code == 400
    user.refresh_from_db()
    assert not user.is_email_verified


@pytest.mark.django_db
def test_verify_email_confirm_token_is_single_use(api, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token_generator.make_token(user)
    api.post("/api/auth/verify-email/confirm/", {"uid": uid, "token": token}, format="json")

    res = api.post("/api/auth/verify-email/confirm/", {"uid": uid, "token": token}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_forgot_password_does_not_leak_account_existence(api, user):
    known = api.post("/api/auth/forgot-password/", {"email": user.email}, format="json")
    unknown = api.post("/api/auth/forgot-password/", {"email": "nobody@example.com"}, format="json")
    assert known.status_code == unknown.status_code == 200
    assert known.data["detail"] == unknown.data["detail"]


@pytest.mark.django_db
def test_reset_password_updates_password(api, user, settings):
    settings.DEBUG = True
    forgot = api.post("/api/auth/forgot-password/", {"email": user.email}, format="json")
    reset_url = forgot.data["reset_url"]
    uid = reset_url.split("uid=")[1].split("&")[0]
    token = reset_url.split("token=")[1]

    res = api.post(
        "/api/auth/reset-password/",
        {"uid": uid, "token": token, "password": "brand-new-pass-1", "confirm_password": "brand-new-pass-1"},
        format="json",
    )
    assert res.status_code == 200

    login = api.post(
        "/api/auth/token/", {"email": user.email, "password": "brand-new-pass-1"}, format="json"
    )
    assert login.status_code == 200


@pytest.mark.django_db
def test_reset_password_rejects_mismatched_confirmation(api, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    res = api.post(
        "/api/auth/reset-password/",
        {"uid": uid, "token": "irrelevant", "password": "a", "confirm_password": "b"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_investor_profile_get_creates_then_put_updates(api, user):
    api.force_authenticate(user)
    get_res = api.get("/api/investors/me/")
    assert get_res.status_code == 200
    assert InvestorProfile.objects.filter(user=user).exists()
    assert get_res.data["is_complete"] is False

    put_res = api.put(
        "/api/investors/me/",
        {"full_name": "Ada Lovelace", "headline": "Angel investor", "country": "GB"},
        format="json",
    )
    assert put_res.status_code == 200
    assert put_res.data["is_complete"] is True
    assert put_res.data["full_name"] == "Ada Lovelace"


@pytest.mark.django_db
def test_investor_profile_verification_fields_are_read_only(api, user):
    api.force_authenticate(user)
    res = api.put("/api/investors/me/", {"is_verified": True}, format="json")
    assert res.status_code == 200
    assert res.data["is_verified"] is False


@pytest.mark.django_db
def test_investor_post_create_and_daily_limit(api, user):
    api.force_authenticate(user)
    payload = {"kind": "update", "title": "Shipped v1", "occurred_at": timezone.now().isoformat()}
    first = api.post("/api/investors/me/posts/", payload, format="json")
    assert first.status_code == 201
    assert InvestorPost.objects.filter(author=user).count() == 1

    second = api.post(
        "/api/investors/me/posts/",
        {**payload, "title": "Another one same day"},
        format="json",
    )
    assert second.status_code == 400
    assert InvestorPost.objects.filter(author=user).count() == 1


@pytest.mark.django_db
def test_investor_post_allowed_again_the_next_day(api, user):
    api.force_authenticate(user)
    payload = {"kind": "update", "title": "Day one", "occurred_at": timezone.now().isoformat()}
    api.post("/api/investors/me/posts/", payload, format="json")
    InvestorPost.objects.filter(author=user).update(created_at=timezone.now() - timedelta(days=1))

    res = api.post(
        "/api/investors/me/posts/",
        {**payload, "title": "Day two"},
        format="json",
    )
    assert res.status_code == 201
    assert InvestorPost.objects.filter(author=user).count() == 2


@pytest.mark.django_db
def test_me_view_reports_profile_and_memberships(api, user):
    api.force_authenticate(user)
    res = api.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["email"] == user.email
    assert res.data["is_email_verified"] is False
    assert res.data["memberships"] == []
