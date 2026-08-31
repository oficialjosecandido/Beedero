from django.contrib import admin
from django.utils import timezone

from .credential_services import approve_credential, reject_credential
from .models import ProfessionalCredential, Verification
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


@admin.register(ProfessionalCredential)
class ProfessionalCredentialAdmin(admin.ModelAdmin):
    list_display = ["user", "title", "issuer", "identifier", "status", "submitted_at"]
    list_filter = ["status"]
    search_fields = ["user__email", "title", "issuer", "identifier"]
    readonly_fields = ["submitted_at", "reviewed_by", "reviewed_at", "document_links"]
    actions = ["approve", "reject", "mark_expired"]

    @admin.display(description="Documents")
    def document_links(self, obj):
        if not obj.document_refs:
            return "—"
        return "\n".join(
            f"{ref['field']}: {private_doc_url(ref['blob'])}" for ref in obj.document_refs
        )

    @admin.action(description="Approve selected")
    def approve(self, request, queryset):
        for credential in queryset.filter(status=ProfessionalCredential.Status.PENDING):
            approve_credential(credential, reviewer=request.user)
        self.message_user(request, "Approved selected pending credentials.")

    @admin.action(description="Reject selected (generic reason)")
    def reject(self, request, queryset):
        for credential in queryset.filter(status=ProfessionalCredential.Status.PENDING):
            reject_credential(credential, reviewer=request.user, reason="Rejected in backoffice review.")
        self.message_user(request, "Rejected selected pending credentials.")

    @admin.action(description="Mark selected as expired")
    def mark_expired(self, request, queryset):
        updated = queryset.filter(status=ProfessionalCredential.Status.VERIFIED).update(
            status=ProfessionalCredential.Status.EXPIRED, valid_until=timezone.now()
        )
        self.message_user(request, f"Marked {updated} credential(s) as expired.")
