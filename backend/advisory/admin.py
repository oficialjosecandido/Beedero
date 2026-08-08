from django.contrib import admin

from .models import AdvisorProfile


@admin.register(AdvisorProfile)
class AdvisorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "is_available", "updated_at"]
    list_filter = ["is_available"]
