"""Rich link preview fetching via a third-party unfurl service (Microlink).

Per spec §A2, this keeps the SSRF-prone "fetch an arbitrary user-supplied
URL server-side" surface off Beedero's own infrastructure entirely —
Microlink performs the outbound fetch (and its own private-IP/redirect/
size guards); we only ever talk to api.microlink.io ourselves.
"""

import logging
from urllib.parse import urlparse

import requests
from django.db import IntegrityError
from django.utils import timezone

from .models import LinkPreview

logger = logging.getLogger(__name__)

MICROLINK_ENDPOINT = "https://api.microlink.io"
REQUEST_TIMEOUT_SECONDS = 4
ALLOWED_SCHEMES = ("http", "https")


def _valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)


def get_or_fetch_preview(url: str) -> LinkPreview | None:
    """Cache-first by url_hash: returns the cached LinkPreview if this URL
    was already resolved (success or failure — a broken link isn't retried
    on every view), otherwise fetches it synchronously via Microlink. No
    task queue exists in this backend, so this is deliberately a bounded,
    on-demand call rather than a background job."""
    if not _valid_url(url):
        return None

    url_hash = LinkPreview.hash_for(url)
    existing = LinkPreview.objects.filter(url_hash=url_hash).first()
    if existing is not None:
        return existing

    preview = LinkPreview(url=url, url_hash=url_hash)
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
    preview.fetched_at = timezone.now()

    try:
        preview.save()
    except IntegrityError:
        # Lost a race against a concurrent fetch of the same URL — the
        # row the other request wrote wins.
        return LinkPreview.objects.filter(url_hash=url_hash).first()
    return preview
