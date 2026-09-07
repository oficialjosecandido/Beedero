from django.urls import path

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
    path("orgs/<slug:slug>/jobs/", OrgJobsListCreateView.as_view()),
    path("orgs/<slug:slug>/jobs/<int:job_id>/", OrgJobDetailView.as_view()),
    path("orgs/<slug:slug>/jobs/<int:job_id>/applications/", OrgJobApplicationsView.as_view()),
    path("jobs/", JobsDiscoveryView.as_view()),
    path("jobs/<int:job_id>/renew/", JobRenewView.as_view()),
    path("jobs/<int:job_id>/apply/", JobApplyView.as_view()),
    path("applications/<int:application_id>/status/", ApplicationStatusView.as_view()),
]
