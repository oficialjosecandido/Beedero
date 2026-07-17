import pytest
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from analytics.models import ProfileView
from orgs.models import Organization, OrgMembership

from .badge import badge_state, badge_visual_status, render_badge_svg
from .levels import credibility_level
from .models import Verification, VerificationType
from .presence import presence_signals
from .vitality import vitality_state


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", email="owner@example.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


def _verify(org, type_, valid_until=None):
    return Verification.objects.create(
        org=org,
        type=type_,
        status=Verification.Status.VERIFIED,
        valid_until=valid_until,
    )


@pytest.mark.django_db
def test_badge_json_is_public(org):
    _verify(org, VerificationType.COMPANY_REGISTRY)
    _verify(org, VerificationType.FOUNDER_ROLE)
    res = APIClient().get("/api/public/badge/acme/json/")
    assert res.status_code == 200
    data = res.json()
    assert data["org"] == "acme"
    assert data["level"] == 1
    assert "layers" in data
    assert "payload" not in data


@pytest.mark.django_db
def test_badge_svg_returns_image(org):
    _verify(org, VerificationType.COMPANY_REGISTRY)
    _verify(org, VerificationType.FOUNDER_ROLE)
    res = APIClient().get("/api/public/badge/acme/svg/")
    assert res.status_code == 200
    assert res["Content-Type"] == "image/svg+xml"
    assert b"<svg" in res.content
    assert b"Acme" in res.content


@pytest.mark.django_db
def test_public_verify_exposes_only_public_fields(org):
    _verify(org, VerificationType.COMPANY_REGISTRY)
    _verify(org, VerificationType.FOUNDER_ROLE)
    res = APIClient().get("/api/public/verify/acme/")
    assert res.status_code == 200
    body = res.json()
    assert "org" in body and "badge" in body
    assert "sections" not in body


@pytest.mark.django_db
def test_presence_signals_zero_when_no_activity(org):
    signals = presence_signals(org)
    assert signals["has_signal"] is False
    assert signals["investor_views"] == 0


@pytest.mark.django_db
def test_presence_signals_requires_real_views(org, owner):
    investor = User.objects.create_user(username="inv", email="inv@example.com", password="x")
    ProfileView.objects.create(org=org, viewer=investor, viewer_is_investor=True)
    signals = presence_signals(org)
    assert signals["investor_views"] == 1
    assert signals["has_signal"] is True


@pytest.mark.django_db
def test_vitality_is_private_to_owner(api, org, owner):
    _verify(org, VerificationType.COMPANY_REGISTRY)
    _verify(org, VerificationType.FOUNDER_ROLE)
    outsider = User.objects.create_user(username="x", email="x@example.com", password="x")
    api.force_authenticate(outsider)
    assert api.get("/api/orgs/acme/vitality/").status_code == 403
    api.force_authenticate(owner)
    res = api.get("/api/orgs/acme/vitality/")
    assert res.status_code == 200
    assert "items" in res.data
    assert "presence" in res.data


@pytest.mark.django_db
def test_badge_embed_owner_only(api, org, owner):
    api.force_authenticate(owner)
    res = api.get("/api/orgs/acme/badge-embed/")
    assert res.status_code == 200
    assert "html" in res.data
    assert "/verify/acme" in res.data["verify_url"]


@pytest.mark.django_db
def test_expiring_badge_visual_status(org):
    _verify(org, VerificationType.COMPANY_REGISTRY, valid_until=timezone.now() + timedelta(days=5))
    _verify(org, VerificationType.FOUNDER_ROLE, valid_until=timezone.now() + timedelta(days=5))
    assert badge_visual_status(org) == "expiring"
    svg = render_badge_svg(badge_state(org))
    assert "Expiring soon" in svg


@pytest.mark.django_db
def test_expiry_warning_messages_are_factual():
    from credibility.management.commands.expire_verifications import (
        FORBIDDEN_URGENCY_PHRASES,
        expiry_warning_message,
    )

    org = Organization.objects.create(slug="x", name="X", status=Organization.Status.LIVE)
    message = expiry_warning_message(org, 7)
    lowered = message.lower()
    assert "7 days" in lowered
    assert not any(phrase in lowered for phrase in FORBIDDEN_URGENCY_PHRASES)
