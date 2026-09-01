from django.urls import path

from . import views

urlpatterns = [
    path("analytics/pageview/", views.SitePageViewCreateView.as_view()),
    path("pipeline/", views.PipelineListCreateView.as_view()),
    path("pipeline/export/", views.PipelineExportView.as_view()),
    path("pipeline/<int:entry_id>/", views.PipelineDetailView.as_view()),
]
