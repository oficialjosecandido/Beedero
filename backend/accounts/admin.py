from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import InvestorProfile, User

admin.site.register(User, UserAdmin)


@admin.register(InvestorProfile)
class InvestorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "is_verified", "verified_at", "check_min", "check_max"]
    list_filter = ["is_verified"]
