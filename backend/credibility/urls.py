from django.urls import path

from . import views

urlpatterns = [
    path("orgs/<slug:slug>/credibility/", views.CredibilityView.as_view()),
    path("orgs/<slug:slug>/verifications/", views.VerificationSubmitView.as_view()),
    path(
        "orgs/<slug:slug>/verifications/<int:verification_id>/documents/<str:ref>/",
        views.VerificationDocumentView.as_view(),
    ),
    path("orgs/<slug:slug>/traction/connect/", views.TractionConnectView.as_view()),
]
