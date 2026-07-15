from django.contrib import admin

from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "participant_one", "participant_two", "last_message_at"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "sender", "created_at", "read_at"]
    search_fields = ["body"]
