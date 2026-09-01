from django.contrib import admin

from .models import DailySiteStats, PipelineEntry, SitePageView


@admin.register(PipelineEntry)
class PipelineEntryAdmin(admin.ModelAdmin):
    list_display = ["investor", "org", "stage", "next_action_at", "updated_at"]
    list_filter = ["stage"]
    search_fields = ["investor__email", "org__slug", "org__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(DailySiteStats)
class DailySiteStatsAdmin(admin.ModelAdmin):
    list_display = ["date", "unique_visitors", "page_views"]
    ordering = ["-date"]
    readonly_fields = ["date", "unique_visitors", "page_views"]

    def has_add_permission(self, request):
        return False


@admin.register(SitePageView)
class SitePageViewAdmin(admin.ModelAdmin):
    list_display = ["path", "visitor_hash", "is_authenticated", "viewed_at"]
    list_filter = ["is_authenticated", "path"]
    search_fields = ["path", "visitor_hash"]
    readonly_fields = ["path", "visitor_hash", "is_authenticated", "viewed_at"]
    ordering = ["-viewed_at"]

    def has_add_permission(self, request):
        return False
