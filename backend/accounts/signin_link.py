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

The same email also carries a six-digit code, and that is the path most people
take: a link can only sign in whichever browser the mail app decides to open,
while a typed code signs in the window it was typed into. See signin_code.py.
Both endpoints below end in the same place — an `oobCode` the frontend redeems
— so there is only one way to actually become signed in, reached two ways.
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

from .signin_code import CODE_RE, CODE_TTL_SECONDS, discard_code, issue_code, verify_code

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
    query = urlencode(params)
    return f"{settings.FRONTEND_URL}{CALLBACK_PATH}{'?' + query if query else ''}"


def mint_oob_code(email, continue_url):
    """Ask Firebase for a one-time sign-in code for `email`. Sends nothing.

    Note what this does not reveal: Firebase creates the account on redemption,
    not here, so the result is identical whether or not the address has one.
    That is what lets both views answer every caller the same way.
    """
    app = get_firebase_app()
    if app is None:
        raise SignInLinkUnavailable("no Firebase service account configured")

    try:
        firebase_link = firebase_auth.generate_sign_in_with_email_link(
            email,
            # Firebase validates this URL's domain against the project's
            # authorized domains, which is why it is passed even on the
            # code path, where the link it comes back inside is discarded.
            firebase_auth.ActionCodeSettings(url=continue_url, handle_code_in_app=True),
            app=app,
        )
    except Exception as exc:
        raise SignInLinkUnavailable("Firebase refused to generate the link") from exc

    oob_code = parse_qs(urlparse(firebase_link).query).get("oobCode", [""])[0]
    if not oob_code:
        raise SignInLinkUnavailable("generated link carried no oobCode")
    return oob_code


def build_signin_link(email, state, next_path):
    """Mint a one-time sign-in link for `email`. Sends nothing."""
    continue_url = _callback_url(state=state, next=next_path)
    oob_code = mint_oob_code(email, continue_url)
    return _callback_url(state=state, next=next_path, mode="signIn", oobCode=oob_code)


def _compose(link, code):
    """The one email, carrying both ways in.

    The code leads because it is the one that always works: it is typed into
    whichever window asked for it, so it doesn't matter which browser the mail
    app decides to open. The link follows for the common case where that
    browser is the right one anyway, and one tap beats six digits.
    """
    safe_link = escape(link)
    code_minutes = CODE_TTL_SECONDS // 60
    text = (
        "Your Beedero sign-in code is:\n\n"
        f"    {code}\n\n"
        f"Type it into the Beedero window where you asked to sign in. It "
        f"expires in {code_minutes} minutes.\n\n"
        "Reading this on the device you want to sign in on? You can just open "
        f"this link instead — it works once, and lasts about {LINK_TTL_HOURS} "
        f"hours:\n{link}\n\n"
        "If you didn't ask to sign in, you can ignore this email. The code and "
        "the link above are the only ways in, and nobody else has them.\n\n"
        "— Beedero\n"
    )
    html = (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;'
        'font-size:15px;line-height:1.55;color:#050604">'
        "<p>Your Beedero sign-in code is:</p>"
        f'<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;'
        "font-size:34px;font-weight:700;letter-spacing:8px;background:#f9de4a;"
        'color:#050604;display:inline-block;padding:14px 22px;border-radius:14px">'
        f"{escape(code)}</p>"
        f'<p style="color:#52525b;font-size:13px">Type it into the Beedero window '
        f"where you asked to sign in. It expires in {code_minutes} minutes.</p>"
        "<p>Reading this on the device you want to sign in on? Open this instead:</p>"
        f'<p><a href="{safe_link}" '
        'style="display:inline-block;padding:12px 22px;border-radius:9999px;'
        "background:#050604;color:#f9de4a;font-weight:700;text-decoration:none\">"
        "Sign in to Beedero</a></p>"
        f'<p style="color:#52525b;font-size:13px">That link works once, and lasts '
        f"about {LINK_TTL_HOURS} hours. If the button doesn't work, paste this "
        f'into your browser:<br><a href="{safe_link}">{safe_link}</a></p>'
        '<p style="color:#52525b;font-size:13px">If you didn\'t ask to sign in, '
        "you can ignore this email — the code and the link above are the only "
        "ways in, and nobody else has them.</p>"
        "<p>— Beedero</p>"
        "</div>"
    )
    return text, html


def send_signin_email(email, state, next_path):
    """Mint the link, issue the code, and email both.

    Raises SignInLinkUnavailable on any failure. Order matters on the way in:
    issuing a code invalidates the address's previous one, so the link — the
    part that can fail — is minted first, and a Firebase outage leaves a code
    already in someone's inbox still usable. On the way out the code is
    discarded if the send fails, which is only tidiness (the next request
    overwrites it anyway), but it keeps "a code exists" meaning "a code was
    delivered".
    """
    link = build_signin_link(email, state, next_path)
    code = issue_code(email)
    text, html = _compose(link, code)
    message = EmailMultiAlternatives(
        "Sign in to Beedero", text, settings.DEFAULT_FROM_EMAIL, [email]
    )
    message.attach_alternative(html, "text/html")
    try:
        message.send()
    except Exception as exc:
        discard_code(email)
        raise SignInLinkUnavailable("Azure Communication Services refused the message") from exc


class _SignInLinkThrottle(SimpleRateThrottle):
    """Rates live here rather than in DEFAULT_THROTTLE_RATES because these are
    the only throttled endpoints in the project, and splitting the limits away
    from the things they protect would only hide them."""

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


class SignInCodeEmailThrottle(_SignInLinkThrottle):
    """A ceiling on guesses against one address, above the five-per-code budget
    in signin_code.py. Set high enough that a person who mistypes, asks for a
    fresh code and mistypes again never meets it."""

    scope = "verify_email"
    rate = "30/hour"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email") or "").strip().lower()
        return self._key(email) if email else None


class SignInCodeIpThrottle(_SignInLinkThrottle):
    """The per-address limits above do nothing against one source working
    through a list of addresses, a few guesses each."""

    scope = "verify_ip"
    rate = "60/hour"

    def get_cache_key(self, request, view):
        return self._key(self.get_ident(request))


class SignInLinkView(APIView):
    """POST /api/auth/signin-link/ — email a code and a link. Public by necessity.

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
            send_signin_email(email, state, next_path)
        except SignInLinkUnavailable as exc:
            # Loudly: a sign-in flow that quietly stops sending is exactly the
            # failure that took a day to notice last time.
            sentry_sdk.capture_exception(exc)
            return Response({"detail": "unavailable"}, status=503)

        return Response(status=204)


class SignInCodeVerifyView(APIView):
    """POST /api/auth/signin-code/verify/ — trade a six-digit code for an oobCode.

    What comes back is a Firebase one-time code: a bearer credential for the
    address, good for one redemption. So it is only ever minted *after* the
    typed code has been checked and consumed, and the endpoint carries the
    tightest limits in the project.

    Every rejection is the same `invalid_code`, whether the code was wrong,
    expired, already used, or never issued at all. Distinguishing them helps
    nobody except someone guessing.
    """

    authentication_classes = []
    permission_classes = []
    throttle_classes = [SignInCodeIpThrottle, SignInCodeEmailThrottle]

    def post(self, request):
        email = str(request.data.get("email") or "").strip().lower()
        code = str(request.data.get("code") or "").strip()

        if not EMAIL_RE.match(email) or len(email) > MAX_EMAIL_LENGTH:
            return Response({"detail": "invalid_email"}, status=400)
        if not CODE_RE.match(code):
            return Response({"detail": "invalid_code"}, status=400)
        if not verify_code(email, code):
            return Response({"detail": "invalid_code"}, status=400)

        try:
            oob_code = mint_oob_code(email, _callback_url())
        except SignInLinkUnavailable as exc:
            # The person did everything right and still can't get in — exactly
            # the failure worth waking someone for.
            sentry_sdk.capture_exception(exc)
            return Response({"detail": "unavailable"}, status=503)

        return Response({"oobCode": oob_code})
