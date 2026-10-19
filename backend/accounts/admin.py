from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import InvestorProfile, User


@admin.register(User)
class BeederoUserAdmin(UserAdmin):
    list_display = [
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_internal",
        "is_active",
        "date_joined",
        "last_seen_at",
    ]
    list_filter = ["is_internal", "is_staff", "is_superuser", "is_active"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering = ["-date_joined"]
    readonly_fields = ["last_seen_at"]
    fieldsets = UserAdmin.fieldsets + (
        ("Metrics", {"fields": ("is_internal", "last_seen_at")}),
    )
    actions = ["mark_internal", "unmark_internal"]

    @admin.action(description="Mark as internal (exclude from metrics)")
    def mark_internal(self, request, queryset):
        updated = queryset.update(is_internal=True)
        self.message_user(request, f"{updated} account(s) marked as internal.")

    @admin.action(description="Unmark internal (include in metrics)")
    def unmark_internal(self, request, queryset):
        updated = queryset.update(is_internal=False)
        self.message_user(request, f"{updated} account(s) included in metrics again.")


@admin.register(InvestorProfile)
class InvestorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "full_name", "handle", "is_verified", "verified_at"]
    list_filter = ["is_verified"]
    search_fields = ["user__email", "full_name", "handle"]
