from django.contrib import admin

from .models import DailyPlatformStats, NexusAction


@admin.register(NexusAction)
class NexusActionAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor_email", "action", "target_type", "target_label", "reason"]
    list_filter = ["action", "target_type"]
    search_fields = ["actor_email", "target_label", "reason", "target_id"]
    readonly_fields = [f.name for f in NexusAction._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DailyPlatformStats)
class DailyPlatformStatsAdmin(admin.ModelAdmin):
    list_display = [
        "date",
        "connections_total",
        "connections_new",
        "messages_new",
        "reactions_new",
        "comments_new",
        "posts_new",
        "requests_pending",
    ]
    readonly_fields = [f.name for f in DailyPlatformStats._meta.fields]
