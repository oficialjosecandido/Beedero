from django.contrib import admin

from .models import CommitmentFee, OrgCredit


@admin.register(CommitmentFee)
class CommitmentFeeAdmin(admin.ModelAdmin):
    list_display = ["org", "amount_cents", "status", "paid_at", "refunded_at"]
    list_filter = ["status"]
    search_fields = ["org__slug", "org__name"]


@admin.register(OrgCredit)
class OrgCreditAdmin(admin.ModelAdmin):
    list_display = ["org", "amount_cents", "reason", "created_at"]
    search_fields = ["org__slug", "org__name"]
