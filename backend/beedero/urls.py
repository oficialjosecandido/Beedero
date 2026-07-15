from django.contrib import admin
from django.urls import include, path

from . import kpis, views

urlpatterns = [
    path("healthz/", views.healthz),
    # Antes de admin/, senão o admin apanha admin/kpis/ como um URL seu e devolve 404.
    path("admin/kpis/", kpis.kpis_view, name="admin-kpis"),
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("orgs.urls")),
    path("api/", include("billing.urls")),
    path("api/", include("credibility.urls")),
    path("api/", include("social.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("messaging.urls")),
    path("api/internal/run-job/", views.run_management_job),
]
