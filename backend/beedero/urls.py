from django.contrib import admin
from django.urls import include, path

from . import views

urlpatterns = [
    path("healthz/", views.healthz),
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("orgs.urls")),
    path("api/", include("billing.urls")),
    path("api/", include("credibility.urls")),
    path("api/", include("social.urls")),
]
