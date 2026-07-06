from django.urls import path

from . import views

urlpatterns = [
    path("billing/stripe/webhook/", views.StripeWebhookView.as_view()),
]
