"""Stripe webhook signature verification.

Deliberately hand-rolled rather than `stripe.Webhook.construct_event`: the
`stripe` package is not a dependency of this project (nothing here calls the
Stripe API — the webhook is the only Stripe surface), and the scheme is small
enough that importing an SDK to read one header would be the larger risk.

The scheme, from Stripe's own docs: the `Stripe-Signature` header carries a
comma-separated list of `key=value` pairs, with `t` holding the Unix timestamp
the request was signed at and one or more `v1` entries holding the expected
signature — `v1` because a second value appears during a secret rotation, and
either is valid. The signature is HMAC-SHA256 over `"{t}.{raw body}"`, keyed
with the endpoint secret (`whsec_...`).

Two details carry the security of the whole thing:

* the HMAC covers the *bytes that arrived*, not a re-serialisation of the
  parsed JSON — a round-trip through a JSON parser changes key order and
  whitespace and would never match;
* the timestamp is checked against a tolerance window, which is what stops a
  captured-and-replayed request from being accepted forever. It is a distinct
  guarantee from the idempotency key: this one rejects a *replayed* request,
  that one rejects a *re-delivered* event.
"""

import hashlib
import hmac
import time

# Stripe's own recommended default.
DEFAULT_TOLERANCE_SECONDS = 300

SIGNATURE_SCHEME = "v1"


class SignatureError(Exception):
    """The request did not come from Stripe, or is too old to be accepted."""


def _parse_header(header):
    """Pull the timestamp and the candidate signatures out of the header.

    Unknown keys are ignored rather than rejected: Stripe adds schemes over
    time (`v0` already exists, for Connect), and a header that happens to
    carry one must not fail a valid `v1`.
    """
    timestamp = None
    signatures = []
    for part in header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            timestamp = value
        elif key == SIGNATURE_SCHEME:
            signatures.append(value)
    return timestamp, signatures


def verify_signature(payload, header, secret, *, tolerance=DEFAULT_TOLERANCE_SECONDS, now=None):
    """Raise `SignatureError` unless `payload` was signed by `secret`.

    `payload` is the raw request body as bytes. An empty `secret` raises —
    this fails closed, so an unconfigured endpoint rejects every delivery
    instead of trusting it.
    """
    if not secret:
        raise SignatureError("No endpoint secret is configured.")
    if not header:
        raise SignatureError("Missing Stripe-Signature header.")

    timestamp, signatures = _parse_header(header)
    if not timestamp or not signatures:
        raise SignatureError("Malformed Stripe-Signature header.")

    try:
        signed_at = int(timestamp)
    except ValueError:
        raise SignatureError("Malformed Stripe-Signature timestamp.") from None

    current = int(now if now is not None else time.time())
    # Both directions: a future timestamp is as much of a red flag as a stale
    # one, and clock skew either way is what the tolerance is for.
    if abs(current - signed_at) > tolerance:
        raise SignatureError("Stripe-Signature timestamp is outside the tolerance window.")

    expected = hmac.new(
        secret.encode("utf-8"),
        timestamp.encode("utf-8") + b"." + payload,
        hashlib.sha256,
    ).hexdigest()

    # compare_digest, not ==, so the comparison doesn't leak the matching
    # prefix length through its timing.
    if not any(hmac.compare_digest(expected, candidate) for candidate in signatures):
        raise SignatureError("Stripe-Signature does not match the payload.")


def sign_payload(payload, secret, *, timestamp=None):
    """Build a valid `Stripe-Signature` header for `payload`.

    Only the tests need this, but it belongs next to the verifier: a test that
    builds the header by hand is testing its own copy of the scheme, and the
    two drift.
    """
    stamp = str(int(timestamp if timestamp is not None else time.time()))
    digest = hmac.new(
        secret.encode("utf-8"),
        stamp.encode("utf-8") + b"." + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={stamp},{SIGNATURE_SCHEME}={digest}"
