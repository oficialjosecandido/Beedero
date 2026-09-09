from django.urls import path

from .views import (
    InvestmentConfirmView,
    InvestmentDisputeView,
    InvestmentListCreateView,
    InvestmentMineView,
    InvestorPortfolioView,
    OrgInvestmentsListCreateView,
    RoundProgressView,
)

urlpatterns = [
    path("investments/", InvestmentListCreateView.as_view()),
    path("investments/mine/", InvestmentMineView.as_view()),
    path("investments/<int:investment_id>/confirm/", InvestmentConfirmView.as_view()),
    path("investments/<int:investment_id>/dispute/", InvestmentDisputeView.as_view()),
    path("orgs/<slug:slug>/investments/", OrgInvestmentsListCreateView.as_view()),
    path("orgs/<slug:slug>/rounds/<int:round_id>/progress/", RoundProgressView.as_view()),
    path("users/<slug:handle>/portfolio/", InvestorPortfolioView.as_view()),
]
