from django.urls import path

from . import views

urlpatterns = [
    path("connections/requests/", views.ConnectionRequestCreateView.as_view()),
    path("connections/requests/pending/", views.PendingConnectionRequestListView.as_view()),
    path("connections/requests/sent/", views.SentConnectionRequestListView.as_view()),
    path("connections/requests/<int:request_id>/accept/", views.ConnectionRequestAcceptView.as_view()),
    path("connections/requests/<int:request_id>/decline/", views.ConnectionRequestDeclineView.as_view()),
    path("connections/requests/<int:request_id>/withdraw/", views.ConnectionRequestWithdrawView.as_view()),
]
