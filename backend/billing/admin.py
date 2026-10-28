from django.contrib import admin
from django.utils import timezone

from .models import (
    BillingAgreement,
    CommitmentFee,
    OrgCredit,
    PaidInvoice,
    PromoCode,
    StripeCustomer,
    StripeEvent,
    Subscription,
)


@admin.register(CommitmentFee)
class CommitmentFeeAdmin(admin.ModelAdmin):
    list_display = ["org", "amount_cents", "status", "paid_at", "refunded_at"]
    list_filter = ["status"]
    search_fields = ["org__slug", "org__name"]


@admin.register(OrgCredit)
class OrgCreditAdmin(admin.ModelAdmin):
    list_display = ["org", "amount_cents", "reason", "created_at"]
    search_fields = ["org__slug", "org__name"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["org", "plan", "status", "source", "promo_code", "trial_end", "current_period_end", "provider_ref"]
    list_filter = ["plan", "status", "source"]
    search_fields = ["org__slug", "org__name", "provider_ref"]
    raw_id_fields = ["org", "user"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ["code", "free_days", "active", "redemptions", "max_redemptions", "expires_at"]
    list_filter = ["active"]
    search_fields = ["code"]

    @admin.display(description="Used")
    def redemptions(self, obj):
        return obj.subscriptions.count()


class FaturaFilter(admin.SimpleListFilter):
    title = "fatura"
    parameter_name = "fatura"

    def lookups(self, request, model_admin):
        return [("missing", "Por emitir"), ("issued", "Emitida")]

    def queryset(self, request, queryset):
        if self.value() == "missing":
            return queryset.filter(fatura_reference="")
        if self.value() == "issued":
            return queryset.exclude(fatura_reference="")
        return queryset


@admin.register(PaidInvoice)
class PaidInvoiceAdmin(admin.ModelAdmin):
    """Each paid Stripe invoice is one fatura-recibo to issue in the certified
    invoicing software. Record its number here once it exists."""

    list_display = [
        "paid_at",
        "org",
        "customer_name",
        "customer_tax_ids",
        "amount",
        "number",
        "fatura_reference",
    ]
    list_filter = [FaturaFilter]
    search_fields = ["org__slug", "customer_name", "number", "fatura_reference"]
    readonly_fields = [
        "org",
        "stripe_invoice_id",
        "number",
        "amount_paid_cents",
        "currency",
        "customer_name",
        "customer_tax_ids",
        "hosted_invoice_url",
        "paid_at",
    ]
    fields = readonly_fields + ["fatura_reference", "fatura_issued_at"]

    @admin.display(description="Amount (VAT incl.)")
    def amount(self, obj):
        return f"{obj.amount_paid_cents / 100:.2f} {obj.currency.upper()}"

    def save_model(self, request, obj, form, change):
        if obj.fatura_reference and not obj.fatura_issued_at:
            obj.fatura_issued_at = timezone.now()
        super().save_model(request, obj, form, change)


@admin.register(BillingAgreement)
class BillingAgreementAdmin(admin.ModelAdmin):
    list_display = ["org", "user", "terms_version", "plan", "accepted_at"]
    search_fields = ["org__slug", "user__email"]
    raw_id_fields = ["org", "user"]


@admin.register(StripeCustomer)
class StripeCustomerAdmin(admin.ModelAdmin):
    list_display = ["org", "provider_ref", "created_at"]
    search_fields = ["org__slug", "provider_ref"]


@admin.register(StripeEvent)
class StripeEventAdmin(admin.ModelAdmin):
    list_display = ["event_id", "type", "received_at"]
    search_fields = ["event_id", "type"]
