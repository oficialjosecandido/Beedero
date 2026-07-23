from django.contrib import admin

from .models import PipelineEntry


@admin.register(PipelineEntry)
class PipelineEntryAdmin(admin.ModelAdmin):
    list_display = ["investor", "org", "stage", "next_action_at", "updated_at"]
    list_filter = ["stage"]
    search_fields = ["investor__email", "org__slug", "org__name"]
    readonly_fields = ["created_at", "updated_at"]
