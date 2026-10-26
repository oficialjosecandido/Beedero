from datetime import UTC

import pytest
from django.core.cache import cache, caches
from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import Throttled

from beedero.ratelimit import enforce_rate_limit


class _FrozenClock:
    """Stands in for the `time` module inside beedero.ratelimit only.

    Patching `time.time` itself would also freeze DatabaseCache's expiry
    arithmetic, which reads the real wall clock back — every entry would be
    born already expired.
    """

    def __init__(self, value: float):
        self.value = value

    def time(self) -> float:
        return self.value


@pytest.fixture
def frozen_clock(monkeypatch):
    """A fixed clock, so which window a call lands in is decided here and not
    by when the suite happens to run."""
    clock = _FrozenClock(1_000_000.0)
    monkeypatch.setattr("beedero.ratelimit.time", clock)
    return clock


def _ttl(cache_key: str) -> float:
    """Seconds left on a DatabaseCache entry, by the raw key the app used."""
    # The stored key carries the backend's prefix and version; ask the backend
    # to translate rather than rebuilding the convention here.
    stored = caches["default"].make_key(cache_key)
    with connection.cursor() as cursor:
        cursor.execute("SELECT expires FROM django_cache WHERE cache_key = %s", [stored])
        row = cursor.fetchone()
    assert row, f"{cache_key} is not in the cache table"
    expires = row[0]
    if timezone.is_naive(expires):
        expires = expires.replace(tzinfo=UTC)
    return (expires - timezone.now()).total_seconds()


@pytest.mark.django_db
def test_rate_limit_shared_across_calls():
    cache.clear()
    key = "test:shared"
    enforce_rate_limit(key, limit=2, window_seconds=60)
    enforce_rate_limit(key, limit=2, window_seconds=60)
    with pytest.raises(Throttled):
        enforce_rate_limit(key, limit=2, window_seconds=60)


@pytest.mark.django_db
def test_separate_keys_do_not_share_a_budget():
    cache.clear()
    enforce_rate_limit("test:a", limit=1, window_seconds=60)
    enforce_rate_limit("test:b", limit=1, window_seconds=60)
    with pytest.raises(Throttled):
        enforce_rate_limit("test:a", limit=1, window_seconds=60)


@pytest.mark.django_db
def test_counter_survives_the_cache_default_timeout(frozen_clock):
    """A daily limit has to last a day.

    `incr()` writes the new value with CACHES' *default* timeout, so a counter
    for any window longer than that used to expire mid-window and hand the
    caller a fresh budget — every daily limit in the app became a five-minute
    one after its second call.
    """
    cache.clear()
    key = "test:daily"
    day = 86400
    enforce_rate_limit(key, limit=2, window_seconds=day)
    enforce_rate_limit(key, limit=2, window_seconds=day)

    cache_key = f"ratelimit:{key}:{int(frozen_clock.value) // day}"
    assert cache.get(cache_key) == 2
    assert _ttl(cache_key) > 3600  # not the 300s default

    with pytest.raises(Throttled):
        enforce_rate_limit(key, limit=2, window_seconds=day)


@pytest.mark.django_db
def test_window_rollover_starts_a_new_budget(frozen_clock):
    cache.clear()
    key = "test:rollover"

    enforce_rate_limit(key, limit=1, window_seconds=60)
    with pytest.raises(Throttled):
        enforce_rate_limit(key, limit=1, window_seconds=60)

    frozen_clock.value += 60
    enforce_rate_limit(key, limit=1, window_seconds=60)
