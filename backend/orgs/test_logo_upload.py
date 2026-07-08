import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import Organization, OrgMembership
from orgs.views import MAX_LOGO_SIZE_BYTES


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.DRAFT)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


def _real_png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="red").save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.django_db
def test_valid_image_upload_succeeds(api, org, owner):
    api.force_authenticate(owner)
    upload = SimpleUploadedFile("logo.png", _real_png_bytes(), content_type="image/png")
    res = api.put(f"/api/orgs/{org.slug}/logo/", {"logo": upload}, format="multipart")
    assert res.status_code == 200
    org.refresh_from_db()
    assert org.logo


@pytest.mark.django_db
def test_non_image_upload_is_rejected_with_400_not_500(api, org, owner):
    """Regression test: run_validation raises django.core.exceptions.ValidationError
    (not DRF's serializers.ValidationError), which used to escape uncaught and 500."""
    api.force_authenticate(owner)
    upload = SimpleUploadedFile("evil.png", b"<script>alert(1)</script>" * 100, content_type="image/png")
    res = api.put(f"/api/orgs/{org.slug}/logo/", {"logo": upload}, format="multipart")
    assert res.status_code == 400
    org.refresh_from_db()
    assert not org.logo


@pytest.mark.django_db
def test_oversized_upload_is_rejected(api, org, owner):
    api.force_authenticate(owner)
    oversized = SimpleUploadedFile("big.png", b"\x00" * (MAX_LOGO_SIZE_BYTES + 1), content_type="image/png")
    res = api.put(f"/api/orgs/{org.slug}/logo/", {"logo": oversized}, format="multipart")
    assert res.status_code == 400
    org.refresh_from_db()
    assert not org.logo


@pytest.mark.django_db
def test_non_owner_cannot_upload_logo(api, org, db):
    outsider = User.objects.create_user(username="outsider", password="x")
    api.force_authenticate(outsider)
    upload = SimpleUploadedFile("logo.png", _real_png_bytes(), content_type="image/png")
    res = api.put(f"/api/orgs/{org.slug}/logo/", {"logo": upload}, format="multipart")
    assert res.status_code in (403, 404)
