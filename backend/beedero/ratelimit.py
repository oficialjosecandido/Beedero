"""Minimal cache-based rate limiting (doc §4) — backed by DatabaseCache so
limits are shared across gunicorn workers (see settings.CACHES).
"""

from django.core.cache import cache
from rest_framework.exceptions import Throttled


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raises Throttled once more than `limit` calls happen for `key` within
    `window_seconds`. The window is fixed (not sliding) — simple and cheap,
    at the cost of allowing brief bursts across a window boundary."""
    cache_key = f"ratelimit:{key}"
    count = cache.get(cache_key, 0)
    if count >= limit:
        raise Throttled(detail="Too many requests. Please try again later.")
    try:
        cache.incr(cache_key)
    except ValueError:
        cache.set(cache_key, 1, timeout=window_seconds)
    else:
        return
