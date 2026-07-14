from django.urls import path

from . import views

urlpatterns = [
    path("notifications/", views.NotificationListView.as_view()),
    path("notifications/unread-count/", views.NotificationUnreadCountView.as_view()),
    path("notifications/mark-read/", views.NotificationMarkReadView.as_view()),
    path("notifications/preferences/", views.NotificationPreferenceView.as_view()),
    path("notifications/digest/unsubscribe/", views.DigestUnsubscribeView.as_view()),
    path("notifications/digest/pixel.gif", views.DigestPixelView.as_view()),
]
