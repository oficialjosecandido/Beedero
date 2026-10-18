from django.urls import path

from .public_views import PublicJobDetailView, PublicJobsView
from .views import (
    ApplicationStatusView,
    JobApplyView,
    JobRenewView,
    JobsDiscoveryView,
    OrgJobApplicationsView,
    OrgJobDetailView,
    OrgJobsListCreateView,
)

urlpatterns = [
    # Public first, and under /api/public/ — the prefix orgs/middleware.py
    # exempts from RLS, because the reader has no account (§3.1).
    path("public/jobs/", PublicJobsView.as_view()),
    path("public/jobs/<int:job_id>/", PublicJobDetailView.as_view()),
    path("orgs/<slug:slug>/jobs/", OrgJobsListCreateView.as_view()),
    path("orgs/<slug:slug>/jobs/<int:job_id>/", OrgJobDetailView.as_view()),
    path("orgs/<slug:slug>/jobs/<int:job_id>/applications/", OrgJobApplicationsView.as_view()),
    path("jobs/", JobsDiscoveryView.as_view()),
    path("jobs/<int:job_id>/renew/", JobRenewView.as_view()),
    path("jobs/<int:job_id>/apply/", JobApplyView.as_view()),
    path("applications/<int:application_id>/status/", ApplicationStatusView.as_view()),
]
