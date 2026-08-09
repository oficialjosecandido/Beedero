from django.urls import path

from . import public_views, views

urlpatterns = [
    path("auth/me/", views.MeView.as_view()),
    path("investors/me/", views.InvestorProfileView.as_view()),
    path("investors/me/posts/", views.InvestorPostListCreateView.as_view()),
    path("investors/me/stats/", views.InvestorStatsView.as_view()),
    path("investors/me/vitality/", views.InvestorVitalityView.as_view()),
    path("investors/me/badge-embed/", views.InvestorBadgeEmbedView.as_view()),
    path("experience/", views.SelfDeclaredExperienceListCreateView.as_view()),
    path("experience/<int:experience_id>/", views.SelfDeclaredExperienceDetailView.as_view()),
    path("public/people/<slug:handle>/", public_views.PublicPersonProfileView.as_view()),
    path("public/pbadge/<slug:handle>/svg/", public_views.PublicPersonBadgeSvgView.as_view()),
    path("public/pbadge/<slug:handle>/json/", public_views.PublicPersonBadgeJsonView.as_view()),
]
