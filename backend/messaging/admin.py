from django.contrib import admin

from .models import Conversation, Message, MessageReport, UserBlock


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "participant_one", "participant_two", "last_message_at"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "sender", "created_at", "read_at"]
    search_fields = ["body"]


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ["id", "blocker", "blocked", "created_at"]


@admin.register(MessageReport)
class MessageReportAdmin(admin.ModelAdmin):
    list_display = ["id", "reporter", "reported_user", "reason", "created_at"]
    list_filter = ["reason"]
    search_fields = ["reporter__email", "reported_user__email", "details"]
    readonly_fields = [f.name for f in MessageReport._meta.fields]

    def has_add_permission(self, request):
        return False
