from django.contrib import admin

from .models import DigestSend, Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "kind", "title", "read_at", "updated_at"]
    list_filter = ["kind"]
    search_fields = ["user__email", "title"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "digest_email", "inapp_engagement"]
    search_fields = ["user__email"]


@admin.register(DigestSend)
class DigestSendAdmin(admin.ModelAdmin):
    list_display = ["user", "sent_at", "opened_at"]
    search_fields = ["user__email"]
