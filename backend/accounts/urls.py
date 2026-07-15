from django.urls import path

from . import views

urlpatterns = [
    path("auth/me/", views.MeView.as_view()),
    path("investors/me/", views.InvestorProfileView.as_view()),
    path("investors/me/posts/", views.InvestorPostListCreateView.as_view()),
    path("investors/me/stats/", views.InvestorStatsView.as_view()),
]
