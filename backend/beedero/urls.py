from django.contrib import admin
from django.urls import include, path

from newsletter import views as newsletter_views

from . import kpis, site_analytics, views

admin.site.site_header = "Beedero Admin"
admin.site.site_title = "Beedero Admin"
admin.site.index_title = "Operations dashboard"

urlpatterns = [
    path("healthz/", views.healthz),
    # Antes de admin/, senão o admin apanha admin/kpis/ como um URL seu e devolve 404.
    path("admin/kpis/", kpis.kpis_view, name="admin-kpis"),
    path("admin/site-analytics/", site_analytics.site_analytics_view, name="admin-site-analytics"),
    path("admin/newsletter/", newsletter_views.newsletter_view, name="admin-newsletter"),
    path("admin/newsletter/send-test/", newsletter_views.newsletter_send_test, name="admin-newsletter-send-test"),
    path("admin/newsletter/send/", newsletter_views.newsletter_send, name="admin-newsletter-send"),
    path(
        "admin/newsletter/recipients/add/",
        newsletter_views.newsletter_recipients_add,
        name="admin-newsletter-recipients-add",
    ),
    path(
        "admin/newsletter/recipients/<int:pk>/delete/",
        newsletter_views.newsletter_recipient_delete,
        name="admin-newsletter-recipient-delete",
    ),
    path("admin/", admin.site.urls),
    path("api/", include("analytics.urls")),
    path("api/", include("accounts.urls")),
    path("api/", include("orgs.urls")),
    path("api/", include("billing.urls")),
    path("api/", include("credibility.urls")),
    path("api/", include("social.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("messaging.urls")),
    path("api/", include("connections.urls")),
    path("api/", include("network.urls")),
    path("api/", include("advisory.urls")),
    path("api/internal/run-job/", views.run_management_job),
]
