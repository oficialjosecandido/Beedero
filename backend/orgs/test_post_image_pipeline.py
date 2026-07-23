import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from orgs.models import Activity, OrgMembership, Organization
from orgs.posting.imaging import MAX_DIMENSION, MAX_UPLOAD_SIZE_BYTES, process_post_image


def _png_bytes(size=(10, 10), color="red"):
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


def test_process_post_image_downscales_and_converts_to_webp():
    upload = SimpleUploadedFile("big.png", _png_bytes(size=(2000, 2500)), content_type="image/png")
    processed = process_post_image(upload)

    with Image.open(processed) as result:
        assert result.format == "WEBP"
        assert max(result.size) <= MAX_DIMENSION
        # Aspect ratio preserved (2000x2500 -> fits within 1600x1600).
        assert result.size == (1280, 1600)


def test_process_post_image_does_not_upscale_small_images():
    upload = SimpleUploadedFile("small.png", _png_bytes(size=(40, 30)), content_type="image/png")
    processed = process_post_image(upload)

    with Image.open(processed) as result:
        assert result.format == "WEBP"
        assert result.size == (40, 30)


def test_process_post_image_rejects_oversized_upload():
    oversized = SimpleUploadedFile(
        "big.png", b"\x00" * (MAX_UPLOAD_SIZE_BYTES + 1), content_type="image/png"
    )
    with pytest.raises(Exception) as exc_info:
        process_post_image(oversized)
    assert "10MB" in str(exc_info.value)


@pytest.mark.django_db
def test_org_update_post_image_is_recompressed_end_to_end(api, org, founder):
    api.force_authenticate(founder)
    upload = SimpleUploadedFile("photo.png", _png_bytes(size=(2000, 2000)), content_type="image/png")

    res = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "Look at this", "image": upload},
        format="multipart",
    )
    assert res.status_code == 201

    activity = Activity.objects.get(pk=res.data["id"])
    assert activity.image.name.endswith(".webp")
    with Image.open(activity.image) as stored:
        assert stored.format == "WEBP"
        assert max(stored.size) <= MAX_DIMENSION


@pytest.mark.django_db
def test_investor_post_image_is_recompressed_end_to_end(api, db):
    investor = User.objects.create_user(username="investor", password="x")
    api.force_authenticate(investor)
    upload = SimpleUploadedFile("photo.png", _png_bytes(size=(2000, 2000)), content_type="image/png")

    res = api.post(
        "/api/investors/me/posts/",
        {
            "kind": "update",
            "title": "Update",
            "body": "hi",
            "occurred_at": "2026-07-21T10:00:00Z",
            "image": upload,
        },
        format="multipart",
    )
    assert res.status_code == 201

    activity = Activity.objects.get(pk=res.data["id"])
    assert activity.image.name.endswith(".webp")
    with Image.open(activity.image) as stored:
        assert stored.format == "WEBP"
        assert max(stored.size) <= MAX_DIMENSION


@pytest.mark.django_db
def test_milestone_post_still_rejects_any_image(api, org, founder):
    api.force_authenticate(founder)
    upload = SimpleUploadedFile("photo.png", _png_bytes(), content_type="image/png")

    res = api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "milestone", "title": "We raised a round", "category": "funding", "image": upload},
        format="multipart",
    )
    assert res.status_code == 400
