from django.urls import path

from . import views

urlpatterns = [
    path("newsletter/unsubscribe/", views.UnsubscribeView.as_view()),
]
