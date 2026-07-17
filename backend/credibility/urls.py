from django.urls import path

from . import public_views, views

urlpatterns = [
    path("orgs/<slug:slug>/credibility/", views.CredibilityView.as_view()),
    path("orgs/<slug:slug>/verifications/", views.VerificationSubmitView.as_view()),
    path(
        "orgs/<slug:slug>/verifications/<int:verification_id>/documents/<str:ref>/",
        views.VerificationDocumentView.as_view(),
    ),
    path("orgs/<slug:slug>/traction/connect/", views.TractionConnectView.as_view()),
    path("orgs/<slug:slug>/badge-embed/", views.BadgeEmbedView.as_view()),
    path("orgs/<slug:slug>/vitality/", views.VitalityView.as_view()),
    path("public/badge/<slug:slug>/svg/", public_views.PublicBadgeSvgView.as_view()),
    path("public/badge/<slug:slug>/json/", public_views.PublicBadgeJsonView.as_view()),
    path("public/verify/<slug:slug>/", public_views.PublicVerifyView.as_view()),
]
