"""Rich link preview fetching via a third-party unfurl service (Microlink).

Per spec §A2, this keeps the SSRF-prone "fetch an arbitrary user-supplied
URL server-side" surface off Beedero's own infrastructure entirely —
Microlink performs the outbound fetch (and its own private-IP/redirect/
size guards); we only ever talk to api.microlink.io ourselves.

The fetch itself happens off the request thread. Microlink can take the full
timeout to answer, and a gunicorn worker held for ten seconds on a third-party
call is a worker not serving anyone — a handful of cold links was enough to
stall the whole pool. The view now gets a PENDING row back straight away and
the client polls for it (`request_preview`).
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.db import IntegrityError, connections
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
# How long a PENDING row is taken to mean "a fetch is in flight" rather than
# "the worker that owned it is gone". Comfortably longer than the request
# timeout, short enough that a restart mid-fetch doesn't strand the URL.
PENDING_RETRY_AFTER = timedelta(minutes=2)

# Threads doing nothing but waiting on a socket, so a few go a long way; the
# cap is what stops a burst of new links from opening one per request.
MAX_BACKGROUND_FETCHES = 4
# Work waiting for one of those threads. Over this, the row is left PENDING
# and the next poll past PENDING_RETRY_AFTER tries again — the preview is
# late, which beats an unbounded queue of outbound calls.
MAX_QUEUED_FETCHES = 32

_executor: ThreadPoolExecutor | None = None
_executor_lock = threading.Lock()
_slots = threading.BoundedSemaphore(MAX_QUEUED_FETCHES)


def _valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)


def _last_attempt_at(existing: LinkPreview):
    return existing.fetched_at or existing.created_at


def _should_refetch(existing: LinkPreview) -> bool:
    if existing.status == LinkPreview.Status.READY:
        return False
    last_attempt = _last_attempt_at(existing)
    if last_attempt is None:
        return True
    if existing.status == LinkPreview.Status.FAILED:
        return timezone.now() - last_attempt >= FAILED_RETRY_AFTER
    # PENDING: either a fetch is running right now, or whoever was running it
    # is no longer around to finish it.
    return timezone.now() - last_attempt >= PENDING_RETRY_AFTER


def _background_enabled() -> bool:
    return bool(getattr(settings, "UNFURL_IN_BACKGROUND", True))


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        with _executor_lock:
            if _executor is None:
                _executor = ThreadPoolExecutor(
                    max_workers=MAX_BACKGROUND_FETCHES,
                    thread_name_prefix="unfurl",
                )
    return _executor


def request_preview(url: str) -> LinkPreview | None:
    """The row for `url`, fetching it in the background if it isn't cached.

    Returns immediately: READY when the URL is already known, otherwise a
    PENDING row for the caller to poll. None only when the URL isn't one we
    would ever unfurl.
    """
    if not _valid_url(url):
        return None

    url_hash = LinkPreview.hash_for(url)
    existing = LinkPreview.objects.filter(url_hash=url_hash).first()
    if existing is not None and not _should_refetch(existing):
        return existing

    if existing is None:
        try:
            preview = LinkPreview.objects.create(
                url=url, url_hash=url_hash, fetched_at=timezone.now()
            )
        except IntegrityError:
            # Lost the race to create it; whoever won is now fetching.
            return LinkPreview.objects.filter(url_hash=url_hash).first()
    else:
        # Claim the retry before dispatching, so concurrent pollers see a
        # fresh PENDING row and queue nothing of their own.
        claimed = LinkPreview.objects.filter(
            pk=existing.pk, fetched_at=existing.fetched_at
        ).update(status=LinkPreview.Status.PENDING, fetched_at=timezone.now())
        preview = LinkPreview.objects.get(pk=existing.pk)
        if not claimed:
            return preview

    # Inline fetching returns the finished row; in the background it is still
    # PENDING, which is what the caller is told.
    return _dispatch(preview.pk, url) or preview


def _dispatch(preview_pk: int, url: str) -> LinkPreview | None:
    if not _background_enabled():
        return _fetch_and_store(preview_pk, url)

    if not _slots.acquire(blocking=False):
        logger.info("unfurl queue is full, leaving %s pending", url)
        return None

    try:
        _get_executor().submit(_run, preview_pk, url)
    except RuntimeError:
        # The interpreter is shutting down and no longer accepts work.
        _slots.release()
        logger.info("unfurl executor is not accepting work, leaving %s pending", url)
    return None


def _run(preview_pk: int, url: str) -> None:
    try:
        _fetch_and_store(preview_pk, url)
    except Exception:
        logger.warning("link preview fetch crashed for %s", url, exc_info=True)
    finally:
        _slots.release()
        # This thread opened its own connection; nothing will reuse it.
        connections.close_all()


def _fetch_and_store(preview_pk: int, url: str) -> LinkPreview | None:
    preview = LinkPreview.objects.filter(pk=preview_pk).first()
    if preview is None:
        return None

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
    preview.save(
        update_fields=[
            "title",
            "description",
            "image_url",
            "site_name",
            "status",
            "fetched_at",
        ]
    )
    return preview
