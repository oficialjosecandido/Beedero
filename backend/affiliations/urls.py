from django.urls import path

from .views import (
    AffiliationAcceptView,
    AffiliationDetailView,
    AffiliationListCreateView,
    AffiliationMineView,
    OrgAffiliationConfirmView,
    OrgAffiliationDisputeView,
    OrgAffiliationsListCreateView,
    OrgAffiliationsPendingView,
    OrgTeamInvitesView,
    PublicTeamInviteDeclineView,
    PublicTeamInviteReportView,
    PublicTeamInviteView,
    TeamInviteAcceptView,
)

urlpatterns = [
    path("affiliations/", AffiliationListCreateView.as_view()),
    path("affiliations/mine/", AffiliationMineView.as_view()),
    path("affiliations/<int:affiliation_id>/", AffiliationDetailView.as_view()),
    path("affiliations/<int:affiliation_id>/accept/", AffiliationAcceptView.as_view()),
    path("orgs/<slug:slug>/affiliations/", OrgAffiliationsListCreateView.as_view()),
    path("orgs/<slug:slug>/affiliations/pending/", OrgAffiliationsPendingView.as_view()),
    path("orgs/<slug:slug>/affiliations/<int:affiliation_id>/confirm/", OrgAffiliationConfirmView.as_view()),
    path("orgs/<slug:slug>/affiliations/<int:affiliation_id>/dispute/", OrgAffiliationDisputeView.as_view()),
    # Team invites by email (doc aquisição §2). The public routes sit under
    # /api/public/ deliberately: that prefix is what the RLS middleware exempts,
    # and the person reading an invite has no account and therefore no viewer id.
    path("orgs/<slug:slug>/team-invites/", OrgTeamInvitesView.as_view()),
    path("public/team-invites/<str:token>/", PublicTeamInviteView.as_view()),
    path("public/team-invites/<str:token>/decline/", PublicTeamInviteDeclineView.as_view()),
    path("public/team-invites/<str:token>/report/", PublicTeamInviteReportView.as_view()),
    path("team-invites/<str:token>/accept/", TeamInviteAcceptView.as_view()),
]
