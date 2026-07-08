from django.db import connection, transaction
from rest_framework_simplejwt.authentication import JWTAuthentication

_jwt_authentication = JWTAuthentication()

# Routes that never read viewer-scoped, RLS-protected data: `public_profile()`
# (orgs/public.py, §3.4) hardcodes `visibility=public` into the query itself
# rather than relying on the DB session, and the auth endpoints below don't
# touch org data at all. Skipping the JWT-auth attempt and the request-wide
# transaction for them is a pure perf win, not a weaker guarantee — public
# rows pass the `field_visibility` policy regardless of whether
# `beedero.viewer_id` is set (docs/rls_postgres.sql: the `visibility =
# 'public'` clause doesn't reference it).
_RLS_EXEMPT_PATH_PREFIXES = (
    "/api/public/",
    "/api/auth/register/",
    "/api/auth/token/",  # covers both /auth/token/ (login) and /auth/token/refresh/
    "/api/auth/forgot-password/",
    "/api/auth/reset-password/",
    "/api/auth/verify-email/confirm/",
    "/api/billing/stripe/webhook/",
)


def _viewer_id(request) -> int:
    """DRF's JWTAuthentication only runs inside APIView.dispatch(), which is
    deeper in the call stack than any middleware's "before" processing — so
    by the time this middleware runs, the plain Django `request.user` set by
    AuthenticationMiddleware is AnonymousUser for every JWT-authenticated
    request (this app has no session-based auth). Re-running the same
    authenticator here is the only way to know the real viewer this early."""
    try:
        result = _jwt_authentication.authenticate(request)
    except Exception:
        return 0
    if result is None:
        return 0
    user, _token = result
    return user.id


class RLSViewerMiddleware:
    """Layer 1 (defense in depth, §3.1).

    Injects the current viewer as a session GUC so Postgres RLS policies
    (backend/docs/rls_postgres.sql) can read it. It's a no-op outside of
    Postgres.

    Wraps the whole request in a transaction: `SET LOCAL` only lasts for the
    current transaction, and Django runs each statement in its own
    autocommit transaction unless one is explicitly opened — without this,
    the setting evaporates before the view's own queries ever run it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if connection.vendor != "postgresql":
            return self.get_response(request)
        if request.path.startswith(_RLS_EXEMPT_PATH_PREFIXES):
            return self.get_response(request)
        viewer_id = _viewer_id(request)
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL beedero.viewer_id = %s", [viewer_id])
            response = self.get_response(request)
        return response


class PrivateCacheMiddleware:
    """§7: authenticated responses never in shared cache."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            response["Cache-Control"] = "private, no-store"
        return response
