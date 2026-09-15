from django.urls import path

from . import views

urlpatterns = [
    path("cofounder/profile/", views.BuilderProfileView.as_view()),
    path("cofounder/status/", views.StatusView.as_view()),
    path("cofounder/deck/", views.DeckView.as_view()),
    path("cofounder/interest/", views.InterestView.as_view()),
    path("cofounder/matches/", views.MatchListView.as_view()),
    path("cofounder/matches/<int:pk>/outcome/", views.MatchOutcomeView.as_view()),
    path("cofounder/matches/<int:pk>/create-org/", views.MatchCreateOrgView.as_view()),
]
