"""Job Offers das Organizações — orgs publish JobPosts, candidates apply
with a short note ("interesse mútuo, não spam de CVs" — same philosophy as
connections/services.py). See docs pasted spec v0.1.
"""

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from orgs.models import Organization

JOB_TTL_DAYS = 7


class EngagementType(models.TextChoices):
    FULL_TIME = "full_time", "Full-time"
    PART_TIME = "part_time", "Part-time"
    CONTRACT = "contract", "Contract"
    INTERNSHIP = "internship", "Internship"
    VOLUNTEER = "volunteer", "Volunteer"
    COFOUNDER = "cofounder", "Co-founder"
    ADVISOR = "advisor", "Advisor"


class CompensationKind(models.TextChoices):
    SALARY = "salary", "Salary"
    EQUITY = "equity", "Equity"
    STOCK_OPTIONS = "stock_options", "Stock options"
    REVENUE_SHARE = "revenue_share", "Revenue share"
    OTHER = "other", "Other"


class JobPost(models.Model):
    class LocationType(models.TextChoices):
        ONSITE = "onsite", "On-site"
        HYBRID = "hybrid", "Hybrid"
        REMOTE = "remote", "Remote"

    class Status(models.TextChoices):
        DRAFT = "draft"
        OPEN = "open"
        CLOSED = "closed"

    org = models.ForeignKey(Organization, related_name="jobs", on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=6000)
    role_area = models.CharField(max_length=60, blank=True, default="")
    engagement_type = models.CharField(max_length=20, choices=EngagementType.choices)
    location_type = models.CharField(max_length=10, choices=LocationType.choices)
    location_city = models.CharField(max_length=80, blank=True, default="")
    salary_text = models.CharField(max_length=120, blank=True, default="")
    # JSONField, not ArrayField — matches every other list field in this
    # codebase (accounts.InvestorProfile.skills, advisory.AdvisorProfile.*).
    skills = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    renewed_at = models.DateTimeField(null=True, blank=True)
    renewal_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["engagement_type", "location_type"]),
        ]

    def __str__(self):
        return f"{self.title} @ {self.org.slug}"

    def mark_open(self):
        self.status = self.Status.OPEN
        self.expires_at = timezone.now() + timedelta(days=JOB_TTL_DAYS)


class JobCompensation(models.Model):
    job = models.ForeignKey(JobPost, related_name="compensation", on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=CompensationKind.choices)
    detail = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["job", "kind"], name="uniq_job_comp_kind")]


class Application(models.Model):
    class Status(models.TextChoices):
        APPLIED = "applied"
        VIEWED = "viewed"
        INTERESTED = "interested"
        DECLINED = "declined"
        HIRED = "hired"

    job = models.ForeignKey(JobPost, related_name="applications", on_delete=models.CASCADE)
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="job_applications", on_delete=models.CASCADE
    )
    note = models.TextField(max_length=1500, blank=True, default="")
    external_link = models.URLField(blank=True, default="")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.APPLIED, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["job", "applicant"], name="uniq_application")]
