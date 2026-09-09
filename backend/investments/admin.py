from django.contrib import admin

from .models import InvestmentRecord


@admin.register(InvestmentRecord)
class InvestmentRecordAdmin(admin.ModelAdmin):
    list_display = ["org", "investor_user", "investor_external_name", "amount_cents", "status", "declarer_side", "created_at"]
    list_filter = ["status", "declarer_side", "currency"]
    search_fields = ["org__slug", "org__name", "investor_user__email", "investor_external_name"]
