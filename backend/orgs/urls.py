from django.urls import path

from . import views

urlpatterns = [
    path("public/orgs/<slug:slug>/", views.PublicOrgProfileView.as_view()),
    path("orgs/", views.OrgListCreateView.as_view()),
    path("orgs/<slug:slug>/", views.OrgProfileView.as_view()),
    path("orgs/<slug:slug>/dataroom/", views.DataRoomView.as_view()),
    path("orgs/<slug:slug>/sections/", views.SectionListView.as_view()),
    path("orgs/<slug:slug>/sections/<str:kind>/fields/<str:key>/", views.SectionFieldView.as_view()),
    path("orgs/<slug:slug>/grants/", views.GrantListCreateView.as_view()),
    path("orgs/<slug:slug>/grants/<int:grant_id>/", views.GrantDetailView.as_view()),
    path("orgs/<slug:slug>/rounds/", views.RoundOpenView.as_view()),
    path("orgs/<slug:slug>/rounds/close/", views.RoundCloseView.as_view()),
    path("orgs/<slug:slug>/feed/", views.FeedPostView.as_view()),
    path("discovery/", views.DiscoveryView.as_view()),
]
