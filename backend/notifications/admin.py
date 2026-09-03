from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import DigestSend, Notification, NotificationBroadcast, NotificationPreference, PushSubscription
from .services import notify

User = get_user_model()


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "kind", "title", "read_at", "updated_at"]
    list_filter = ["kind"]
    search_fields = ["user__email", "title"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "digest_email", "inapp_engagement", "push_enabled"]
    search_fields = ["user__email"]


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "last_seen_at"]
    search_fields = ["user__email", "token"]


@admin.register(NotificationBroadcast)
class NotificationBroadcastAdmin(admin.ModelAdmin):
    list_display = ["title", "target_all", "sent_count", "created_by", "created_at"]
    list_filter = ["target_all"]
    search_fields = ["title", "body"]
    filter_horizontal = ["users"]
    readonly_fields = ["created_by", "created_at", "sent_count"]

    def get_fields(self, request, obj=None):
        return ["title", "body", "link", "target_all", "users", "created_by", "created_at", "sent_count"]

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return self.readonly_fields
        # Already sent — freeze the whole thing into a read-only audit record.
        return self.readonly_fields + ["title", "body", "link", "target_all", "users"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        if change:
            return

        obj = form.instance
        recipients = User.objects.filter(is_active=True) if obj.target_all else obj.users.all()
        sent = 0
        for recipient in recipients.iterator():
            notify(
                recipient,
                kind=Notification.Kind.BROADCAST,
                aggregate_key=f"broadcast:{obj.id}:{recipient.id}",
                title=obj.title,
                body=obj.body,
                link=obj.link,
            )
            sent += 1
        obj.sent_count = sent
        obj.save(update_fields=["sent_count"])


@admin.register(DigestSend)
class DigestSendAdmin(admin.ModelAdmin):
    list_display = ["user", "sent_at", "opened_at"]
    search_fields = ["user__email"]
