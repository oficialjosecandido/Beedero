from django.urls import path

from . import views

urlpatterns = [
    path("activities/<int:activity_id>/reactions/", views.ActivityReactionView.as_view()),
    path("activities/<int:activity_id>/participation/", views.ActivityParticipationView.as_view()),
    path("activities/<int:activity_id>/comments/", views.ActivityCommentListCreateView.as_view()),
    path("comments/<int:comment_id>/", views.CommentDeleteView.as_view()),
    path("me/events/attending/", views.UserAttendingEventsView.as_view()),
    path("mentions/search/", views.MentionSearchView.as_view()),
    path("links/preview/", views.LinkPreviewView.as_view()),
]
