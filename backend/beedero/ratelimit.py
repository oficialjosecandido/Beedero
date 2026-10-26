"""Minimal cache-based rate limiting (doc §4) — backed by the shared cache so
limits hold across gunicorn workers (see settings.CACHES).
"""

import time

from django.core.cache import cache
from rest_framework.exceptions import Throttled


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raises Throttled once more than `limit` calls happen for `key` within
    `window_seconds`.

    The window is fixed, not sliding — simple and cheap, at the cost of
    allowing brief bursts across a window boundary. It is fixed by putting the
    window's number in the cache key rather than by relying on the entry's
    expiry: Django's generic `incr()` is a get followed by a `set()` that
    takes the *default* timeout, so a counter whose window is longer than
    CACHES' default used to quietly reset mid-window (every daily limit in the
    app was effectively a five-minute limit after its second call). With the
    window in the key, a rolled-over window reads a key that does not exist
    yet, whatever happened to the old one's expiry.

    The count is read back from the increment instead of before it, so there
    is no gap between checking and counting. On Redis that makes the whole
    limit atomic (INCR is). On DatabaseCache the increment itself is a
    read-then-write, so simultaneous requests can still share a count and slip
    a few past the limit — one more reason to set REDIS_URL in production.
    """
    window = max(1, int(window_seconds))
    bucket = int(time.time()) // window
    cache_key = f"ratelimit:{key}:{bucket}"
    # Twice the window is slack for cleanup only: the key stops being read the
    # moment the window rolls over, so its lifetime past that is immaterial.
    ttl = window * 2

    if cache.add(cache_key, 1, timeout=ttl):
        count = 1
    else:
        try:
            count = cache.incr(cache_key)
        except ValueError:
            # Expired between the add and the incr — start this window again.
            cache.set(cache_key, 1, timeout=ttl)
            count = 1
        else:
            # Repair the expiry `incr()` just shortened to the default
            # timeout. `touch` moves the deadline and leaves the value alone,
            # so it can't clobber a concurrent increment.
            cache.touch(cache_key, ttl)

    if count > limit:
        raise Throttled(detail="Too many requests. Please try again later.")
