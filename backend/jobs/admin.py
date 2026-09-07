from django.contrib import admin

from .models import Application, JobCompensation, JobPost


class JobCompensationInline(admin.TabularInline):
    model = JobCompensation
    extra = 0


@admin.register(JobPost)
class JobPostAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "org", "engagement_type", "status", "created_at", "expires_at"]
    list_filter = ["status", "engagement_type", "location_type"]
    search_fields = ["title", "org__name"]
    inlines = [JobCompensationInline]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["id", "job", "applicant", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["job__title", "applicant__email"]
