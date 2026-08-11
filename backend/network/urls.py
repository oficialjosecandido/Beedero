from django.urls import path

from . import views

urlpatterns = [
    path("network/connections/", views.NetworkConnectionsView.as_view()),
    path("network/connections/<int:connection_id>/", views.NetworkConnectionDetailView.as_view()),
    path("network/following/", views.NetworkFollowingView.as_view()),
    path("network/followers/", views.NetworkFollowersView.as_view()),
    path("network/counts/", views.NetworkCountsView.as_view()),
]
