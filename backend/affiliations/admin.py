from django.contrib import admin

from .models import Affiliation, RoleType
from .services import dispute_founder, verify_founder_via_registry


@admin.register(Affiliation)
class AffiliationAdmin(admin.ModelAdmin):
    """Founder-certificate review: open the underlying company_registry/
    founder_role Verification via credibility.admin.VerificationAdmin's SAS
    link, then come here, filter by org + role=founder, and act on the
    specific self-declared founders who check out. Purely additive — never
    touches credibility/admin.py or credibility/services.py."""

    list_display = ["user", "org", "role", "status", "verified_via", "created_at"]
    list_filter = ["role", "status", "verified_via"]
    search_fields = ["org__slug", "org__name", "user__email"]
    actions = ["mark_founder_verified", "mark_founder_disputed"]

    @admin.action(description="Mark founder verified (registry)")
    def mark_founder_verified(self, request, queryset):
        for affiliation in queryset.filter(role=RoleType.FOUNDER):
            verify_founder_via_registry(affiliation, reviewer=request.user)
        self.message_user(request, "Verified selected founder claims via registry.")

    @admin.action(description="Mark founder disputed")
    def mark_founder_disputed(self, request, queryset):
        for affiliation in queryset.filter(role=RoleType.FOUNDER):
            dispute_founder(affiliation, reviewer=request.user)
        self.message_user(request, "Disputed selected founder claims.")
