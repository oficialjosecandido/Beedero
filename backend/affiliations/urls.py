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
]
