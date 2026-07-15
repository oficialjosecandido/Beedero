from django.urls import path

from . import views

urlpatterns = [
    path("contacts/", views.MessageContactsView.as_view()),
    path("conversations/", views.ConversationListCreateView.as_view()),
    path("conversations/<int:conversation_id>/messages/", views.ConversationMessageListCreateView.as_view()),
]
