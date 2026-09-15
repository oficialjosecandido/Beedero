from django.contrib import admin

from .models import BuilderProfile, CofounderInterest, CofounderMatch


@admin.register(BuilderProfile)
class BuilderProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "is_active", "primary_strength", "commitment", "updated_at"]
    list_filter = ["is_active", "primary_strength", "commitment", "has_idea"]
    search_fields = ["user__email"]


@admin.register(CofounderInterest)
class CofounderInterestAdmin(admin.ModelAdmin):
    list_display = ["actor", "target", "liked", "created_at"]
    list_filter = ["liked"]
    search_fields = ["actor__email", "target__email"]


@admin.register(CofounderMatch)
class CofounderMatchAdmin(admin.ModelAdmin):
    list_display = ["id", "user_a", "user_b", "outcome", "org", "created_at"]
    list_filter = ["outcome"]
    search_fields = ["user_a__email", "user_b__email"]
