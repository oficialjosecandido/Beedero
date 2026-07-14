import pytest
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from beedero.ratelimit import enforce_rate_limit


@pytest.mark.django_db
def test_rate_limit_shared_across_calls():
    cache.clear()
    key = "test:shared"
    enforce_rate_limit(key, limit=2, window_seconds=60)
    enforce_rate_limit(key, limit=2, window_seconds=60)
    with pytest.raises(Throttled):
        enforce_rate_limit(key, limit=2, window_seconds=60)
