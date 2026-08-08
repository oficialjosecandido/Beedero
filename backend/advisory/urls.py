from django.urls import path

from . import views

urlpatterns = [
    path("advisory/me/", views.AdvisorProfileView.as_view()),
]
