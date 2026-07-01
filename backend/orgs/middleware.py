from django.db import connection


class RLSViewerMiddleware:
    """Camada 1 (defesa em profundidade, §3.1).

    Injeta o viewer atual como GUC de sessão para que as políticas RLS do
    Postgres (backend/docs/rls_postgres.sql) o consigam ler. É um no-op fora
    do Postgres — no MVP corremos em SQLite, que não suporta RLS, por isso a
    única linha de defesa real por agora é o VisibilityResolver (camada 2).
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
    """§7: respostas autenticadas nunca em cache partilhada."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            response["Cache-Control"] = "private, no-store"
        return response
