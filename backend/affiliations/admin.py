from django.contrib import admin
from django.utils import timezone

from .models import Affiliation, RoleType, TeamInviteReport
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


class PendingFilter(admin.SimpleListFilter):
    """Pending by default — an unfiltered list of complaints is a list nobody works."""

    title = "status"
    parameter_name = "state"

    def lookups(self, request, model_admin):
        return [("pending", "Pending resolution"), ("resolved", "Resolved"), ("all", "All")]

    def queryset(self, request, queryset):
        value = self.value()
        if value == "resolved":
            return queryset.filter(resolved_at__isnull=False)
        if value == "all":
            return queryset
        return queryset.filter(resolved_at__isnull=True)

    def choices(self, changelist):
        # Django's default "All" choice would be selected when nothing is
        # picked, which here would lie: nothing picked means pending.
        for lookup, title in self.lookup_choices:
            yield {
                "selected": self.value() == lookup or (self.value() is None and lookup == "pending"),
                "query_string": changelist.get_query_string({self.parameter_name: lookup}),
                "display": title,
            }


@admin.register(TeamInviteReport)
class TeamInviteReportAdmin(admin.ModelAdmin):
    """The queue of people who objected to being invited.

    Opens on the pending ones because that is the only reason to open it: the
    default filter is `pending`, the model's ordering puts unresolved first,
    and resolving is an explicit action a named admin takes, recorded with
    their name and the date.

    Everything is read-only except `resolution`. The complaint is the
    recipient's statement, not ours to edit, and the one thing an admin adds
    is what they did about it. Nothing here shows the complainant's address —
    reporting deletes it (see `TeamInviteReport`), and the invite, the org and
    the date are what a reviewer actually needs.
    """

    list_display = ["id", "state", "org", "reason", "created_at", "resolved_at", "resolved_by"]
    list_filter = ["reason", "created_at"]
    search_fields = ["org__slug", "org__name", "note", "resolution"]
    readonly_fields = ["invite", "org", "reason", "note", "created_at", "resolved_at", "resolved_by"]
    actions = ["mark_resolved", "reopen"]
    date_hierarchy = "created_at"

    @admin.display(description="Status", ordering="resolved_at")
    def state(self, obj):
        return "Resolved" if obj.resolved_at else "⚠ Pending"

    def get_list_filter(self, request):
        # A "pending / resolved" filter the ORM has no field for: `resolved_at`
        # is a date, and a date filter is not a queue.
        return [PendingFilter, *self.list_filter]

    @admin.action(description="Mark resolved")
    def mark_resolved(self, request, queryset):
        # Only the pending ones: re-resolving a resolved report would overwrite
        # the name of whoever actually dealt with it.
        count = queryset.filter(resolved_at__isnull=True).update(
            resolved_at=timezone.now(), resolved_by=request.user
        )
        self.message_user(request, f"Resolved {count} report(s).")

    @admin.action(description="Reopen (back to pending)")
    def reopen(self, request, queryset):
        count = queryset.filter(resolved_at__isnull=False).update(
            resolved_at=None, resolved_by=None
        )
        self.message_user(request, f"Reopened {count} report(s).")
