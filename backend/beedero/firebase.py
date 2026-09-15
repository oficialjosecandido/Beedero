"""Shared firebase-admin app.

`firebase_admin.initialize_app()` raises if called twice for the same app
name, so every consumer (FCM push, ID-token verification) has to go through
this one accessor rather than initialising its own.

Returns None when no service account is configured. The two callers treat
that differently on purpose: push degrades to a silent no-op (it's a
progressive enhancement), while authentication refuses every request, since
"we can't check this token" must never read as "this token is fine".
"""

import json

from django.conf import settings

_app = None
_init_attempted = False


def get_firebase_app():
    global _app, _init_attempted
    if _init_attempted:
        return _app
    _init_attempted = True

    if not settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        return None

    import firebase_admin
    from firebase_admin import credentials

    cred = credentials.Certificate(json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON))
    _app = firebase_admin.initialize_app(cred)
    return _app
