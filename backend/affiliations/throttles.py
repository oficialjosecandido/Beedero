"""Rate limits for the endpoints a visitor with no account can reach.

Lives beside the views rather than in DEFAULT_THROTTLE_RATES for the same
reason accounts/signin_link.py keeps its rates inline: a limit written far
away from the thing it protects is a limit nobody reads when they change that
thing.
"""

import hashlib

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class _IpThrottle(SimpleRateThrottle):
    def _key(self, ident: str) -> str:
        # Hashed, salted with SECRET_KEY: the cache is a shared database table,
        # so writing visitor IPs into key names would make it a visitor log.
        digest = hashlib.sha256(f"{settings.SECRET_KEY}:{self.scope}:{ident}".encode()).hexdigest()[:32]
        return f"throttle_{self.scope}_{digest}"

    def get_cache_key(self, request, view):
        return self._key(self.get_ident(request))


class TeamInviteTokenThrottle(_IpThrottle):
    """The invite preview and the decline button.

    Tokens are 32 bytes of `secrets.token_urlsafe`, so this is not what stops
    guessing — nothing does, at that size. It stops one source from walking the
    endpoint, and keeps a link pasted into a group chat from turning into a
    load problem. Generous enough that a real person reading, deciding, and
    reloading never meets it.
    """

    scope = "team_invite_token"
    rate = "60/hour"
