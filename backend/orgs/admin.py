from django.contrib import admin

from .models import (
    FundraiseRound,
    OrgField,
    OrgMembership,
    Organization,
    OrgSection,
    RestrictedAccessLog,
    VisibilityGrant,
)


class OrgMembershipInline(admin.TabularInline):
    model = OrgMembership
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["slug", "name", "is_verified", "is_fundraising", "created_at"]
    list_filter = ["is_verified", "is_fundraising"]
    search_fields = ["slug", "name"]
    inlines = [OrgMembershipInline]


class OrgFieldInline(admin.TabularInline):
    model = OrgField
    extra = 0


@admin.register(OrgSection)
class OrgSectionAdmin(admin.ModelAdmin):
    list_display = ["org", "kind", "visibility", "archived_at"]
    list_filter = ["kind", "visibility"]
    inlines = [OrgFieldInline]


@admin.register(OrgField)
class OrgFieldAdmin(admin.ModelAdmin):
    list_display = ["section", "key", "visibility"]
    list_filter = ["visibility"]


@admin.register(VisibilityGrant)
class VisibilityGrantAdmin(admin.ModelAdmin):
    list_display = ["org", "section", "field", "principal_type", "principal_id", "expires_at"]
    list_filter = ["principal_type"]


@admin.register(FundraiseRound)
class FundraiseRoundAdmin(admin.ModelAdmin):
    list_display = ["org", "stage", "is_open", "opened_at", "closed_at"]


@admin.register(RestrictedAccessLog)
class RestrictedAccessLogAdmin(admin.ModelAdmin):
    list_display = ["org", "viewer", "field_key", "section_kind", "accessed_at"]
    list_filter = ["section_kind"]
    readonly_fields = [f.name for f in RestrictedAccessLog._meta.fields]

    def has_add_permission(self, request):
        return False
