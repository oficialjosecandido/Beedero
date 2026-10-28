from django.urls import path

from . import views

urlpatterns = [
    path("cofounder/profile/", views.BuilderProfileView.as_view()),
    path("cofounder/status/", views.StatusView.as_view()),
    path("cofounder/deck/", views.DeckView.as_view()),
    path("cofounder/interest/", views.InterestView.as_view()),
    path("cofounder/matches/", views.MatchListView.as_view()),
    # No create-org/ here: the organisation is created on /orgs/new, which
    # carries the match (orgs/create_flow.py), so it chooses a plan like any
    # other.
    path("cofounder/matches/<int:pk>/outcome/", views.MatchOutcomeView.as_view()),
]
