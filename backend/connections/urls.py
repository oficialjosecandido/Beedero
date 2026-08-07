from django.urls import path

from . import views

urlpatterns = [
    path("connections/requests/", views.ConnectionRequestCreateView.as_view()),
    path("connections/requests/pending/", views.PendingConnectionRequestListView.as_view()),
    path("connections/requests/<int:request_id>/accept/", views.ConnectionRequestAcceptView.as_view()),
    path("connections/requests/<int:request_id>/decline/", views.ConnectionRequestDeclineView.as_view()),
    path("orgs/<slug:slug>/connections/requests/", views.OrgConnectionRequestCreateView.as_view()),
    path(
        "orgs/<slug:slug>/connections/requests/pending/",
        views.OrgConnectionRequestPendingListView.as_view(),
    ),
    path(
        "orgs/<slug:slug>/connections/requests/<int:request_id>/accept/",
        views.OrgConnectionRequestAcceptView.as_view(),
    ),
    path(
        "orgs/<slug:slug>/connections/requests/<int:request_id>/decline/",
        views.OrgConnectionRequestDeclineView.as_view(),
    ),
    path("orgs/<slug:slug>/connections/outreach/", views.OrgOutreachCreateView.as_view()),
]
