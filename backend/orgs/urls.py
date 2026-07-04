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
    path("orgs/<slug:slug>/follow/", views.FollowOrgView.as_view()),
    path("users/<int:user_id>/follow/", views.FollowUserView.as_view()),
    path("orgs/<slug:slug>/logo/", views.OrgLogoView.as_view()),
    path("orgs/<slug:slug>/stats/", views.OrgStatsView.as_view()),
    path("orgs/<slug:slug>/members/", views.OrgMembersView.as_view()),
    path("orgs/<slug:slug>/members/<int:member_id>/", views.OrgMemberDetailView.as_view()),
    path("orgs/<slug:slug>/invites/", views.OrgInviteListCreateView.as_view()),
    path("orgs/<slug:slug>/invites/<int:invite_id>/", views.OrgInviteDetailView.as_view()),
    path("invites/<str:token>/accept/", views.OrgInviteAcceptView.as_view()),
    path("feed/", views.FeedView.as_view()),
    path("recommendations/", views.RecommendationView.as_view()),
    path("discovery/", views.DiscoveryView.as_view()),
]
