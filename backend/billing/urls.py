from django.urls import path

from . import views

urlpatterns = [
    path("billing/stripe/webhook/", views.StripeWebhookView.as_view()),
    path("billing/codes/<str:code>/", views.PromoCodeView.as_view()),
    path("orgs/<slug:slug>/billing/", views.OrgBillingView.as_view()),
    path("orgs/<slug:slug>/billing/checkout/", views.OrgCheckoutView.as_view()),
    path("orgs/<slug:slug>/billing/redeem/", views.OrgRedeemView.as_view()),
    path("orgs/<slug:slug>/billing/sync/", views.OrgCheckoutSyncView.as_view()),
    path("orgs/<slug:slug>/billing/portal/", views.OrgPortalView.as_view()),
]
