from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Activity,
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
    list_display = ["slug", "name", "status", "is_verified", "is_fundraising", "created_at"]
    list_filter = ["status", "is_verified", "is_fundraising"]
    search_fields = ["slug", "name"]
    ordering = ["-created_at"]
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
    list_display = ["org", "stage", "is_open", "opened_at", "closed_at", "ask_amount", "raised_amount"]


@admin.register(RestrictedAccessLog)
class RestrictedAccessLogAdmin(admin.ModelAdmin):
    list_display = ["org", "viewer", "field_key", "section_kind", "accessed_at"]
    list_filter = ["section_kind"]
    readonly_fields = [f.name for f in RestrictedAccessLog._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "kind",
        "subject_display",
        "author_display",
        "visibility",
        "occurred_at",
        "reaction_count",
        "comment_count",
    ]
    list_filter = ["kind", "visibility"]
    search_fields = ["title", "body", "org__slug", "org__name", "author__email", "author__username"]
    ordering = ["-occurred_at", "-id"]
    date_hierarchy = "occurred_at"
    readonly_fields = [
        "org",
        "author",
        "kind",
        "title",
        "body",
        "image",
        "occurred_at",
        "ends_at",
        "visibility",
        "created_at",
        "reaction_count",
        "comment_count",
        "feed_impression_count",
        "payload",
        "source_org_field_id",
        "source_investor_post_id",
    ]
    fieldsets = (
        (None, {"fields": ("kind", "title", "body", "image", "visibility")}),
        ("Subject", {"fields": ("org", "author")}),
        ("Timing", {"fields": ("occurred_at", "ends_at", "created_at")}),
        (
            "Engagement",
            {"fields": ("reaction_count", "comment_count", "feed_impression_count")},
        ),
        ("Metadata", {"fields": ("payload", "source_org_field_id", "source_investor_post_id")}),
    )

    @admin.display(description="Subject")
    def subject_display(self, obj: Activity):
        if obj.org_id:
            return format_html('<a href="/admin/orgs/organization/{}/change/">{}</a>', obj.org_id, obj.org.name)
        return "Personal post"

    @admin.display(description="Author")
    def author_display(self, obj: Activity):
        if not obj.author_id:
            return "—"
        label = obj.author.email or obj.author.username
        return format_html('<a href="/admin/accounts/user/{}/change/">{}</a>', obj.author_id, label)

    def has_add_permission(self, request):
        return False
