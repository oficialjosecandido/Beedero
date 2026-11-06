"""Automatic screening of feed photos for prohibited imagery.

Every feed photo already passes through one place — `imaging.
PostImageValidationMixin` — so this is the only hook needed to cover org
updates, org events and personal posts alike: all three write into the same
`orgs.Activity.image`.

Azure AI Content Safety rather than a classifier of our own: it scores nudity
*and* violence (and hate and self-harm) in a single call, and its free tier
covers 5,000 images a month. A self-hosted model would be loaded once per
gunicorn worker — three copies, for nudity alone.

Three outcomes, decided by the worst severity across the four categories:

  >= CONTENT_SAFETY_BLOCK_AT   refused, 400, nothing reaches blob storage
  >= CONTENT_SAFETY_FLAG_AT    posts, and waits in the Nexus posts queue
                               under `?state=flagged` for a person
  below both                   posts

**It never blocks because of its own failure.** No key configured, endpoint
down, timeout, or the free quota spent — Azure stops the free tier rather than
billing an overage — and the photo posts, flagged for review. A moderation
service having a bad day must not be able to close posting for everyone.
"""

import base64
import io
import logging
from dataclasses import dataclass

import requests
from django.conf import settings
from PIL import Image
from rest_framework import serializers

logger = logging.getLogger(__name__)

CATEGORIES = ("Sexual", "Violence", "Hate", "SelfHarm")
TIMEOUT_SECONDS = 5
# Content Safety refuses anything under 50x50, and there is nothing to
# recognise in a thumbnail that small in any case.
MIN_DIMENSION = 50
# Set on the file object when screening wants a person to look. Read back by
# `orgs.services.create_activity`, which is where it becomes a database row.
FLAG_ATTR = "_beedero_moderation_flag"
# Screening could not run. Treated as a flag, never as a block.
UNSCREENED = "unscreened"

# Deliberately says nothing about which category tripped, for the same reason
# the Stripe webhook returns no detail: the only people reading it closely are
# the ones looking for the half to adjust.
REFUSED = (
    "That image looks like it breaks our Terms of Service (§6) and was not published. "
    "If you believe this is a mistake, contact us."
)


@dataclass(frozen=True)
class Verdict:
    block: bool = False
    #: "sexual:2", or UNSCREENED. Empty when the photo is clean.
    flag: str = ""


def _setting(name: str, default):
    return getattr(settings, name, default)


def configured() -> bool:
    return bool(_setting("CONTENT_SAFETY_ENDPOINT", "") and _setting("CONTENT_SAFETY_KEY", ""))


def _as_jpeg(data: bytes) -> bytes | None:
    """`imaging.process_post_image` has just produced WebP, which is not among
    the formats Content Safety documents. Re-encoding the already-downscaled
    image settles the question and is far cheaper than sending the original
    upload. None when the image is too small to screen."""
    with Image.open(io.BytesIO(data)) as opened:
        if min(opened.size) < MIN_DIMENSION:
            return None
        buffer = io.BytesIO()
        opened.convert("RGB").save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def severities(jpeg: bytes) -> dict[str, int]:
    """{category: severity} from Content Safety. Raises on any failure."""
    endpoint = str(_setting("CONTENT_SAFETY_ENDPOINT", "")).rstrip("/")
    response = requests.post(
        f"{endpoint}/contentsafety/image:analyze",
        params={"api-version": _setting("CONTENT_SAFETY_API_VERSION", "2024-09-01")},
        headers={"Ocp-Apim-Subscription-Key": _setting("CONTENT_SAFETY_KEY", "")},
        json={
            "image": {"content": base64.b64encode(jpeg).decode()},
            "categories": list(CATEGORIES),
        },
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return {
        str(item.get("category", "")): int(item.get("severity") or 0)
        for item in response.json().get("categoriesAnalysis", [])
    }


def screen(data: bytes) -> Verdict:
    """Decide what to do with the bytes of a recompressed feed photo."""
    if not configured():
        return Verdict()
    try:
        jpeg = _as_jpeg(data)
        if jpeg is None:
            return Verdict()
        scores = severities(jpeg)
    except Exception:
        # Fails open, on purpose — see the module docstring.
        logger.exception("Image screening failed; publishing the photo flagged instead")
        return Verdict(flag=UNSCREENED)

    category, severity = max(scores.items(), key=lambda pair: pair[1], default=("", 0))
    if severity >= int(_setting("CONTENT_SAFETY_BLOCK_AT", 4)):
        return Verdict(block=True, flag=f"{category.lower()}:{severity}")
    if severity >= int(_setting("CONTENT_SAFETY_FLAG_AT", 2)):
        return Verdict(flag=f"{category.lower()}:{severity}")
    return Verdict()


def screen_upload(image):
    """Screen a recompressed upload on its way through serializer validation:
    refuse the worst of it, mark the uncertain, return the file either way."""
    if not image:
        return image
    image.seek(0)
    verdict = screen(image.read())
    image.seek(0)
    if verdict.block:
        raise serializers.ValidationError(REFUSED)
    if verdict.flag:
        setattr(image, FLAG_ATTR, verdict.flag)
    return image


def flag_on(image) -> str:
    """The flag `screen_upload` left on a file.

    It rides on the file object because that object is already what both
    posting paths hand to `orgs.services.create_activity` — the one place an
    Activity row is made, and so the one place the flag can be persisted
    without every serializer growing a `create()` of its own.
    """
    return getattr(image, FLAG_ATTR, "") if image is not None else ""
