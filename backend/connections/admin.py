from django.contrib import admin

from .models import Connection, ConnectionRequest


@admin.register(ConnectionRequest)
class ConnectionRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "requester", "recipient", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["requester__email", "recipient__email"]


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ["id", "user_one", "user_two", "created_at"]
    search_fields = ["user_one__email", "user_two__email"]
