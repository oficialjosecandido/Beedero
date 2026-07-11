from django.contrib import admin

from .models import Verification
from .services import approve_verification, reject_verification
from .storage import private_doc_url


@admin.register(Verification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ["org", "type", "status", "submitted_at", "valid_until"]
    list_filter = ["type", "status"]
    search_fields = ["org__slug", "org__name"]
    readonly_fields = ["submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "document_links"]
    actions = ["approve", "reject"]

    @admin.display(description="Documents")
    def document_links(self, obj):
        if not obj.document_refs:
            return "—"
        # 10-minute SAS per doc §6 — regenerated fresh every time this page
        # renders, never persisted, so sharing this admin page doesn't leak
        # a durable link.
        return "\n".join(
            f"{ref['field']}: {private_doc_url(ref['blob'])}" for ref in obj.document_refs
        )

    @admin.action(description="Approve selected")
    def approve(self, request, queryset):
        for verification in queryset.filter(status=Verification.Status.PENDING):
            approve_verification(verification, reviewer=request.user)
        self.message_user(request, "Approved selected pending verifications.")

    @admin.action(description="Reject selected (generic reason)")
    def reject(self, request, queryset):
        # Bulk action has no per-row reason field — for a documented reason
        # per rejection, open the row and use the (not yet built) detail
        # action instead. Good enough for the manual-review MVP (doc §7).
        for verification in queryset.filter(status=Verification.Status.PENDING):
            reject_verification(verification, reviewer=request.user, reason="Rejected in backoffice review.")
        self.message_user(request, "Rejected selected pending verifications.")
