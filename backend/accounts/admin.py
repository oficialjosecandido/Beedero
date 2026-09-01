from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import InvestorProfile, User


@admin.register(User)
class BeederoUserAdmin(UserAdmin):
    list_display = ["username", "email", "first_name", "last_name", "is_staff", "is_active", "date_joined"]
    list_filter = ["is_staff", "is_superuser", "is_active"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering = ["-date_joined"]


@admin.register(InvestorProfile)
class InvestorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "full_name", "handle", "is_verified", "verified_at"]
    list_filter = ["is_verified"]
    search_fields = ["user__email", "full_name", "handle"]
