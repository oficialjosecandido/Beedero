"""Recompresses post photos before they ever reach blob storage — without
this, a raw phone photo (often several MB) is stored and served at full
size on every feed view; egress on that, not disk, is what actually costs
money at scale."""

import io

from PIL import Image, ImageOps
from django.core.files.base import ContentFile
from rest_framework import serializers

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
MAX_DIMENSION = 1600
WEBP_QUALITY = 80


def process_post_image(image):
    """Downscales to fit within MAX_DIMENSION on its longest side (never
    upscales) and re-encodes as WebP. Runs as a DRF `validate_<field>` hook,
    i.e. after ImageField's own validation already opened the upload with
    Pillow to confirm it's a real, decodable image — so Image.open() here
    never sees untrusted/undecodable bytes."""
    if image.size > MAX_UPLOAD_SIZE_BYTES:
        raise serializers.ValidationError("Image must be 10MB or smaller.")

    image.seek(0)
    with Image.open(image) as opened:
        opened = ImageOps.exif_transpose(opened)
        if opened.mode == "RGBA" or (opened.mode == "P" and "transparency" in opened.info):
            opened = opened.convert("RGBA")
        else:
            opened = opened.convert("RGB")
        opened.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

        buffer = io.BytesIO()
        opened.save(buffer, format="WEBP", quality=WEBP_QUALITY)

    return ContentFile(buffer.getvalue(), name="post.webp")


def process_logo_image(image):
    """Square-ish logos: smaller max dimension than feed photos."""
    if image.size > MAX_UPLOAD_SIZE_BYTES:
        raise serializers.ValidationError("Image must be 10MB or smaller.")

    image.seek(0)
    with Image.open(image) as opened:
        opened = ImageOps.exif_transpose(opened)
        if opened.mode == "RGBA" or (opened.mode == "P" and "transparency" in opened.info):
            opened = opened.convert("RGBA")
        else:
            opened = opened.convert("RGB")
        opened.thumbnail((512, 512), Image.LANCZOS)

        buffer = io.BytesIO()
        opened.save(buffer, format="WEBP", quality=WEBP_QUALITY)

    return ContentFile(buffer.getvalue(), name="logo.webp")


class PostImageValidationMixin:
    """Mix into any serializer with an `image = serializers.ImageField(...)`
    to recompress it on the way in — shared by orgs.posting.payloads (org
    updates/events) and accounts.serializers.InvestorPostSerializer, which
    both write into the same orgs.Activity.image field."""

    def validate_image(self, value):
        return process_post_image(value) if value else value
