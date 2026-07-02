from django.db import connection


class RLSViewerMiddleware:
    """Layer 1 (defense in depth, §3.1).

    Injects the current viewer as a session GUC so Postgres RLS policies
    (backend/docs/rls_postgres.sql) can read it. It's a no-op outside of
    Postgres — in the MVP we run on SQLite, which doesn't support RLS, so the
    only real line of defense for now is the VisibilityResolver (layer 2).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if connection.vendor == "postgresql":
            viewer_id = request.user.id if getattr(request, "user", None) and request.user.is_authenticated else 0
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL beedero.viewer_id = %s", [viewer_id])
        return self.get_response(request)


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
