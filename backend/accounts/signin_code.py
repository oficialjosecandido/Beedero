"""The six-digit sign-in code.

A magic link can only sign in the browser that opens it, and that browser is
not always the one the person is using. On iOS especially: a link tapped in
Mail always opens Safari, and a Home Screen app has its own cookie jar, so the
link signs Safari in and leaves the installed Beedero app exactly as logged out
as it was. Nothing in a web app can change where iOS sends that tap.

A code has no such problem. It is typed into the window that asked for it, so
the session lands where the person actually is — the installed app, a desktop
browser, a second device — without anything having to route a URL correctly.
The same email carries both, and the link stays the one-tap path for people
reading their mail on the device they're signing in on.

Codes live in the cache, not a table. They're worthless ten minutes from now,
the cache is the shared database table already backing the sign-in throttles
(so this works across App Service workers), and an expiring row is the one
thing a cache gives away for free.
"""

import hashlib
import re
import secrets
import time

from django.conf import settings
from django.core.cache import cache

# Long enough to walk to another device and back, short enough that a code
# read over someone's shoulder is usually dead by the time it's used.
CODE_TTL_SECONDS = 10 * 60

# Six digits is a million combinations, and this is the budget for guessing
# them. Together with the 5-sends-per-hour limit in signin_link.py, a
# determined attacker gets at most 25 guesses an hour against one address —
# about a one-in-forty-thousand chance per hour, from a campaign that is also
# mailing the victim five times an hour while it runs.
MAX_ATTEMPTS = 5

CODE_RE = re.compile(r"^\d{6}$")


def _cache_key(email):
    # The cache is a shared database table, so the address is hashed rather
    # than written into a key name, salted the same way the throttles are.
    digest = hashlib.sha256(f"{settings.SECRET_KEY}:{email}".encode()).hexdigest()[:32]
    return f"signin_code_{digest}"


def _digest(email, code):
    """Hash the code with the address baked in.

    The cache key is already per-address, so this is belt and braces — but it
    means a digest lifted from one row can't be replayed against another.
    """
    return hashlib.sha256(f"{settings.SECRET_KEY}:{email}:{code}".encode()).hexdigest()


def issue_code(email):
    """Mint a code for `email`, remember it, and return it for the email body.

    Any code previously issued to this address stops working here: the entry is
    overwritten, so the newest email is always the one that counts. That's the
    behaviour people expect when they hit "send it again", and it keeps the
    guess budget from being multiplied by the number of codes in flight.
    """
    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(
        _cache_key(email),
        {
            "digest": _digest(email, code),
            "attempts": 0,
            # Carried in the value because a wrong guess has to rewrite the
            # entry, and rewriting it is what would otherwise restart the clock.
            "expires_at": time.time() + CODE_TTL_SECONDS,
        },
        CODE_TTL_SECONDS,
    )
    return code


def discard_code(email):
    """Forget the outstanding code — used when the email it belonged to never
    got sent, so a code nobody can read isn't left occupying the address."""
    cache.delete(_cache_key(email))


def verify_code(email, code):
    """True if `code` is the live code for `email`. Consumes it either way.

    Every failure mode — no code outstanding, expired, wrong, too many wrong
    guesses — answers False. The caller turns all of them into one message,
    because telling them apart only helps someone who is guessing.
    """
    if not CODE_RE.match(code or ""):
        return False

    key = _cache_key(email)
    entry = cache.get(key)
    if not isinstance(entry, dict) or "digest" not in entry:
        return False

    if secrets.compare_digest(str(entry["digest"]), _digest(email, code)):
        # One use only: a code that has worked once must not work again, even
        # within its ten minutes.
        cache.delete(key)
        return True

    attempts = int(entry.get("attempts", 0)) + 1
    remaining = int(float(entry.get("expires_at", 0)) - time.time())
    if attempts >= MAX_ATTEMPTS or remaining <= 0:
        cache.delete(key)
    else:
        # Re-set with what's left of the original window, never a fresh one:
        # otherwise wrong guesses would keep a code alive indefinitely.
        cache.set(key, {**entry, "attempts": attempts}, remaining)
    return False
