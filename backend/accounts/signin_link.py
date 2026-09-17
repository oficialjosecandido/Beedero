"""Beedero-branded sign-in emails.

Firebase will email the magic link itself, and for a while it did. The problem
is what it sends: from `noreply@<project-id>.firebaseapp.com`, subject "Sign in
to beedero-9356d", signed "Your beedero-9356d team", carrying a link whose
visible host is also firebaseapp.com — a domain shared with every other Firebase
project in existence. Gmail files that as spam, and it has earned it: nothing
about the message says Beedero, and the one thing a sign-in email must survive
is looking like phishing.

So the code stays Firebase's and the email becomes ours.
`generate_sign_in_with_email_link()` mints a one-time code without sending
anything, and Azure Communication Services — already the transport for every
other transactional email here — delivers a message from a domain whose SPF,
DKIM and DMARC we control.

The link in that message points straight at the frontend callback rather than
at Firebase's action handler. The handler's only job for mode=signIn is to
redirect to `continueUrl` with `oobCode` and `mode` appended, so doing that
ourselves costs nothing and buys an email in which every URL is a beedero.com
one. The code is redeemed the same way either way (accounts:signInWithEmailLink
takes the code and the address, and neither cares which URL carried it).
"""

import hashlib
import re
from urllib.parse import parse_qs, urlencode, urlparse

import sentry_sdk
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape
from firebase_admin import auth as firebase_auth
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from beedero.firebase import get_firebase_app

CALLBACK_PATH = "/api/auth/callback"

# Deliberately loose — the real validation is whether the link arrives. This
# only rejects what can't be an address at all, so the throttle below isn't
# spent on garbage. 254 is the RFC 5321 maximum.
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
MAX_EMAIL_LENGTH = 254

# The frontend's randomState(): a UUID with the dashes taken out. Pinning the
# shape keeps a caller from stuffing anything else into a URL we then email.
STATE_RE = re.compile(r"^[0-9a-f]{32}$")

# Firebase sign-in links are good for six hours; lib/session.ts sizes its
# pending-link cookies to match.
LINK_TTL_HOURS = 6


class SignInLinkUnavailable(Exception):
    """The link could not be minted or the email could not be handed off.

    Always an operator problem — a missing service account, Firebase down, ACS
    refusing the message. Never the visitor's fault, so the frontend turns it
    into "try again shortly" rather than anything that blames the address.
    """


def safe_next_path(value, fallback="/feed"):
    """Narrow a post-sign-in destination to a path on this site.

    Mirrors safeNextPath in lib/firebase-auth.ts, and for the same reason: this
    value ends up in an emailed link, so "//evil.com" and "https://evil.com"
    would both be open redirects on a login flow — exactly what phishing wants.
    The frontend narrows it before sending and this narrows it again, because
    the endpoint is public and nothing here may assume the frontend was the
    caller.
    """
    if not value or not value.startswith("/") or value.startswith("//"):
        return fallback
    return value


def _callback_url(**params):
    return f"{settings.FRONTEND_URL}{CALLBACK_PATH}?{urlencode(params)}"


def build_signin_link(email, state, next_path):
    """Mint a one-time sign-in link for `email`. Sends nothing.

    Note what this does not reveal: Firebase creates the account on redemption,
    not here, so the result is identical whether or not the address has one.
    That is what lets the view answer every caller the same way.
    """
    app = get_firebase_app()
    if app is None:
        raise SignInLinkUnavailable("no Firebase service account configured")

    # Firebase validates this URL's domain against the project's authorized
    # domains, which is why it is passed even though the link it comes back
    # inside is discarded.
    continue_url = _callback_url(state=state, next=next_path)
    try:
        firebase_link = firebase_auth.generate_sign_in_with_email_link(
            email,
            firebase_auth.ActionCodeSettings(url=continue_url, handle_code_in_app=True),
            app=app,
        )
    except Exception as exc:
        raise SignInLinkUnavailable("Firebase refused to generate the link") from exc

    oob_code = parse_qs(urlparse(firebase_link).query).get("oobCode", [""])[0]
    if not oob_code:
        raise SignInLinkUnavailable("generated link carried no oobCode")

    return _callback_url(state=state, next=next_path, mode="signIn", oobCode=oob_code)


def _compose(link):
    safe_link = escape(link)
    text = (
        "Here is your sign-in link for Beedero:\n\n"
        f"{link}\n\n"
        f"It works once, and expires in about {LINK_TTL_HOURS} hours.\n\n"
        "Using the Beedero app on iPhone? Copy this link and paste it into the "
        "app after requesting sign-in there — email taps open Safari, which "
        "can't share your login with the app.\n\n"
        "If you didn't ask to sign in, you can ignore this email — the link "
        "above is the only way in, and nobody else has it.\n\n"
        "— Beedero\n"
    )
    html = (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;'
        'font-size:15px;line-height:1.55;color:#050604">'
        "<p>Here is your sign-in link for Beedero:</p>"
        f'<p><a href="{safe_link}" '
        'style="display:inline-block;padding:12px 22px;border-radius:9999px;'
        "background:#f9de4a;color:#050604;font-weight:700;text-decoration:none\">"
        "Sign in to Beedero</a></p>"
        f"<p style=\"color:#52525b;font-size:13px\">It works once, and expires in "
        f"about {LINK_TTL_HOURS} hours. If the button doesn't work, paste this "
        f'into your browser:<br><a href="{safe_link}">{safe_link}</a></p>'
        '<p style="color:#52525b;font-size:13px">Using the Beedero app on iPhone? '
        "Copy the link and paste it into the app after requesting sign-in there "
        "— email taps open Safari, which can't share your login with the app.</p>"
        '<p style="color:#52525b;font-size:13px">If you didn\'t ask to sign in, '
        "you can ignore this email — the link above is the only way in, and "
        "nobody else has it.</p>"
        "<p>— Beedero</p>"
        "</div>"
    )
    return text, html


def send_signin_link(email, state, next_path):
    """Mint the link and email it. Raises SignInLinkUnavailable on any failure."""
    link = build_signin_link(email, state, next_path)
    text, html = _compose(link)
    message = EmailMultiAlternatives(
        "Sign in to Beedero", text, settings.DEFAULT_FROM_EMAIL, [email]
    )
    message.attach_alternative(html, "text/html")
    try:
        message.send()
    except Exception as exc:
        raise SignInLinkUnavailable("Azure Communication Services refused the message") from exc


class _SignInLinkThrottle(SimpleRateThrottle):
    """Rates live here rather than in DEFAULT_THROTTLE_RATES because this is the
    only throttled endpoint in the project, and splitting the limit away from
    the thing it protects would only hide it."""

    def _key(self, ident):
        # The cache is a shared database table, so addresses are hashed rather
        # than written into key names. SECRET_KEY as the salt makes the digests
        # useless to anyone who can read the table but not the settings.
        digest = hashlib.sha256(f"{settings.SECRET_KEY}:{ident}".encode()).hexdigest()[:32]
        return f"throttle_signin_link_{self.scope}_{digest}"


class SignInLinkEmailThrottle(_SignInLinkThrottle):
    """One address can only be mailed so often — otherwise this endpoint is a
    free way to bury someone's inbox."""

    scope = "email"
    rate = "5/hour"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email") or "").strip().lower()
        return self._key(email) if email else None


class SignInLinkIpThrottle(_SignInLinkThrottle):
    """And one source can only spray so many different addresses — the per-email
    limit above does nothing against a list."""

    scope = "ip"
    rate = "20/hour"

    def get_cache_key(self, request, view):
        return self._key(self.get_ident(request))


class SignInLinkView(APIView):
    """POST /api/auth/signin-link/ — email a magic link. Public by necessity.

    Answers 204 whether or not the address has an account: the reply is the
    same either way, so this can't be used to find out who's a member.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [SignInLinkIpThrottle, SignInLinkEmailThrottle]

    def post(self, request):
        email = str(request.data.get("email") or "").strip().lower()
        state = str(request.data.get("state") or "").strip()
        next_path = safe_next_path(str(request.data.get("next") or ""))

        if not EMAIL_RE.match(email) or len(email) > MAX_EMAIL_LENGTH:
            return Response({"detail": "invalid_email"}, status=400)
        if not STATE_RE.match(state):
            return Response({"detail": "invalid_state"}, status=400)

        try:
            send_signin_link(email, state, next_path)
        except SignInLinkUnavailable as exc:
            # Loudly: a sign-in flow that quietly stops sending is exactly the
            # failure that took a day to notice last time.
            sentry_sdk.capture_exception(exc)
            return Response({"detail": "unavailable"}, status=503)

        return Response(status=204)
