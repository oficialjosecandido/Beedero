"""Rich link preview fetching via a third-party unfurl service (Microlink).

Per spec §A2, this keeps the SSRF-prone "fetch an arbitrary user-supplied
URL server-side" surface off Beedero's own infrastructure entirely —
Microlink performs the outbound fetch (and its own private-IP/redirect/
size guards); we only ever talk to api.microlink.io ourselves.
"""

import logging
from datetime import timedelta
from urllib.parse import urlparse

import requests
from django.db import IntegrityError
from django.utils import timezone

from .models import LinkPreview

logger = logging.getLogger(__name__)

MICROLINK_ENDPOINT = "https://api.microlink.io"
# Paywalled publishers (FT, etc.) often need longer than a tight 4s budget.
REQUEST_TIMEOUT_SECONDS = 10
ALLOWED_SCHEMES = ("http", "https")
# Transient Microlink/timeout failures should be retried — permanent READY
# and recent FAILED rows stay cached so we don't hammer the unfurl service.
FAILED_RETRY_AFTER = timedelta(minutes=15)


def _valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)


def _should_refetch(existing: LinkPreview) -> bool:
    if existing.status == LinkPreview.Status.READY:
        return False
    if existing.status != LinkPreview.Status.FAILED:
        return False
    if not existing.fetched_at:
        return True
    return timezone.now() - existing.fetched_at >= FAILED_RETRY_AFTER


def get_or_fetch_preview(url: str) -> LinkPreview | None:
    """Cache-first by url_hash: returns READY immediately; retries FAILED
    after a short cooldown (timeouts / paywalls shouldn't brick a URL forever).
    No task queue exists in this backend, so this is a bounded on-demand call."""
    if not _valid_url(url):
        return None

    url_hash = LinkPreview.hash_for(url)
    existing = LinkPreview.objects.filter(url_hash=url_hash).first()
    if existing is not None and not _should_refetch(existing):
        return existing

    preview = existing or LinkPreview(url=url, url_hash=url_hash)
    try:
        response = requests.get(
            MICROLINK_ENDPOINT, params={"url": url}, timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "success":
            raise ValueError("microlink returned a non-success status")
        data = payload.get("data") or {}

        preview.title = (data.get("title") or "")[:300]
        preview.description = (data.get("description") or "")[:500]
        preview.image_url = ((data.get("image") or {}).get("url") or "")[:2000]
        preview.site_name = (data.get("publisher") or "")[:200]
        preview.status = LinkPreview.Status.READY
    except Exception:
        logger.info("link preview fetch failed for %s", url, exc_info=True)
        preview.status = LinkPreview.Status.FAILED
        preview.title = ""
        preview.description = ""
        preview.image_url = ""
        preview.site_name = ""
    preview.fetched_at = timezone.now()

    try:
        preview.save()
    except IntegrityError:
        # Lost a race against a concurrent fetch of the same URL — the
        # row the other request wrote wins.
        return LinkPreview.objects.filter(url_hash=url_hash).first()
    return preview
