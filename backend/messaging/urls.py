from django.urls import path

from . import views

urlpatterns = [
    path("contacts/", views.MessageContactsView.as_view()),
    path("conversations/", views.ConversationListCreateView.as_view()),
    path("conversations/<int:conversation_id>/messages/", views.ConversationMessageListCreateView.as_view()),
    path("conversations/<int:conversation_id>/report/", views.ConversationReportView.as_view()),
    path("blocks/", views.BlockListCreateView.as_view()),
    path("blocks/<int:user_id>/", views.BlockDetailView.as_view()),
    path("orgs/<slug:slug>/conversations/", views.OrgConversationListCreateView.as_view()),
    path(
        "orgs/<slug:slug>/conversations/<int:conversation_id>/messages/",
        views.OrgConversationMessageListCreateView.as_view(),
    ),
]
