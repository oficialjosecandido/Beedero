"""Where a person came from — captured once, at the only moment it is knowable.

Doc `beedero-aquisicao-pessoas.md` §8. The point is not analytics for its own
sake: §7 lists a dozen channels to work by hand, and without this the only
honest answer to "which of them brought people who stayed" is a guess.

§8.1 of that doc describes hanging the `ref` off "o estado PKCE que já existe"
and reading it back in the callback. That machinery is gone — the Entra
External ID flow it referred to was replaced by Firebase email-link sign-in
(commit ef2e3cb), which has no PKCE state and no callback this code controls.

So the ref travels a different way, and the one chosen is the alternative the
same paragraph offers: *"só URL, sem armazenamento no dispositivo"*. The ref
arrives in the URL (`/register?ref=job:123`), rides along with the email the
person types into the sign-in form, and is parked **server-side** — in the
shared cache, keyed by a salted digest of the address, for as long as the
sign-in link itself is valid. Nothing is written to the visitor's device, so
the `[REVISÃO LEGAL]` question that paragraph raises (does storing the origin
beside the auth state need cookie consent?) does not arise: there is no
client-side storage to consent to. What remains is a transient server-side
note about an address the person just typed into our own form.

Claiming it in `get_or_provision_firebase_user` then satisfies §8.2 literally —
"preenchido **uma vez**, em `get_or_provision_user`" — and has three properties
the device-storage route would not:

  - it works cross-device (type the address on a laptop, click the link on a
    phone, and the origin still lands on the right row);
  - it works on the six-digit-code path as well as the link path, because both
    start at the same form;
  - it cannot be forged into someone else's account, since the only row it can
    ever write to is one created by a *verified* sign-in for that same address.
"""

import hashlib
import re

from django.conf import settings
from django.core.cache import cache

# How long a parked ref stays claimable. Sized to the sign-in link's own life
# (accounts/signin_link.py LINK_TTL_HOURS = 6) plus a little slack: a ref that
# outlives the link it came with would start attaching stale origins to people
# who signed up days later from somewhere else entirely.
REF_TTL_SECONDS = 7 * 60 * 60

MAX_SOURCE_LENGTH = 40
MAX_REF_LENGTH = 120

# The vocabulary of §7 plus the four cycles of §2–§5. A closed set on purpose:
# `signup_source` is what the funnel groups by, and a field anyone can write
# free text into degrades into a thousand buckets of one. Anything outside this
# list is recorded in `signup_ref` but grouped as "other", so an unplanned
# channel is still visible without being able to pollute the grouping.
KNOWN_SOURCES = frozenset(
    {
        # Cycles — a feature of the product brought this person in.
        "job",  # §3  a public job page
        "invite",  # §2  a team invite from an org
        "profile",  # §4  someone's public profile or badge
        "cofounder",  # §5  the public co-founder page
        "share",  # §3.4/§4  a link somebody shared
        # Field channels — §7. Worked by hand, measured the same way.
        "uni",
        "partner",
        "event",
        "meetup",
        "whatsapp",
        "linkedin",
    }
)

# `source` or `source:detail` — "job", "job:123", "uni:ist", "share:waverent".
# Lowercase and narrow because this string ends up in a `GROUP BY` and in an
# admin page; the detail half allows dots, dashes and underscores so slugs and
# dates ("meetup:2026-11-04") pass unchanged.
_SOURCE_RE = re.compile(r"^[a-z][a-z0-9]{0,19}$")
_DETAIL_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")


def parse_ref(raw) -> tuple[str, str]:
    """Normalize an inbound `?ref=` into `(source, ref)`, or `("", "")`.

    Returns a pair rather than one string because the two are used for
    different things and must not be conflated: `source` is the funnel's
    grouping key and is therefore constrained to `KNOWN_SOURCES`, while `ref`
    keeps the full detail for reading by eye ("which job?", "which university?").

    Anything unparseable returns empty — a bad ref means "origin unknown", never
    an error. This runs on a public, unauthenticated path, so it has to be
    unfailingly boring about garbage.
    """
    if not raw:
        return "", ""
    value = str(raw).strip().lower()
    if not value or len(value) > MAX_REF_LENGTH:
        return "", ""

    head, _, detail = value.partition(":")
    if not _SOURCE_RE.match(head):
        return "", ""
    if detail and not _DETAIL_RE.match(detail):
        # A recognisable source with unusable detail is still worth keeping:
        # "job:<garbage>" at least tells us a job page sent this person.
        detail = ""

    source = head if head in KNOWN_SOURCES else "other"
    ref = f"{head}:{detail}" if detail else head
    return source[:MAX_SOURCE_LENGTH], ref[:MAX_REF_LENGTH]


def _cache_key(email: str) -> str:
    """Key by digest, not by address.

    Same reasoning as the throttles in accounts/signin_link.py: the cache is a
    shared database table, so writing addresses into key names would turn it
    into a list of everyone mid-signup. SECRET_KEY as the salt makes the
    digests useless to anyone who can read the table but not the settings.
    """
    digest = hashlib.sha256(f"{settings.SECRET_KEY}:ref:{email}".encode()).hexdigest()[:32]
    return f"signup_ref_{digest}"


def stash_ref(email: str, raw_ref) -> None:
    """Park the origin for an address that has just asked to sign in.

    Deliberately *not* `cache.add`: the last form submission wins. Someone who
    asks for a link from a job page, abandons it, then asks again from a
    co-founder page came in from the co-founder page as far as the second link
    is concerned, and that is the one they will click.
    """
    source, ref = parse_ref(raw_ref)
    if not source:
        return
    cache.set(_cache_key(email), {"source": source, "ref": ref}, REF_TTL_SECONDS)


def claim_ref(email: str) -> dict | None:
    """Take the parked origin for `email`, if any, and consume it.

    Consumed rather than read so one parked ref can only ever mark one account.
    """
    if not email:
        return None
    key = _cache_key(email.strip().lower())
    value = cache.get(key)
    if value:
        cache.delete(key)
    return value or None


def apply_signup_origin(user, email: str) -> None:
    """Write the origin onto a user row — once, and only if it is still blank.

    First write wins, which is what §8.2's "preenchido uma vez" has to mean in
    practice: a person signs in many times and only the first of those arrivals
    says anything about where they came from. A later sign-in from a shared
    link must not rewrite history.
    """
    if user.signup_source:
        return
    origin = claim_ref(email)
    if not origin:
        return
    user.signup_source = origin["source"]
    user.signup_ref = origin["ref"]
    user.save(update_fields=["signup_source", "signup_ref"])
