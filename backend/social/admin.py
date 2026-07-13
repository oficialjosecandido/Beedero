from django.contrib import admin

from .models import Comment, Reaction


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ["activity", "user", "kind", "created_at"]
    list_filter = ["kind"]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["activity", "author", "parent", "created_at", "deleted_at"]
    search_fields = ["body"]
