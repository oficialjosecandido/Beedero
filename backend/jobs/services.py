"""Business logic for jobs — mirrors connections/services.py's plain-function,
@transaction.atomic-on-writes convention.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from beedero.ratelimit import enforce_rate_limit
from messaging.services import get_or_create_org_conversation, is_org_member, send_org_message
from notifications.models import Notification
from notifications.services import notify
from orgs.models import Organization, OrgMembership

from .models import Application, JobCompensation, JobPost
from .permissions import is_org_owner_or_admin

DAILY_JOB_POST_LIMIT = 10
DAILY_APPLICATION_LIMIT = 30


def org_admins(org):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()


@transaction.atomic
def create_job(org, *, created_by, title, description, engagement_type, location_type, compensation_kinds, **fields):
    """Publishes immediately (no separate draft step in the API — see
    jobs/views.py). `compensation_kinds` is a list of {kind, detail} dicts;
    a job can carry zero, one, or several combined (spec: "sem regras
    rígidas")."""
    if org.status != Organization.Status.LIVE:
        raise ValidationError({"org": "Only live organizations can publish jobs."})

    enforce_rate_limit(f"job-post:{org.id}", limit=DAILY_JOB_POST_LIMIT, window_seconds=86400)

    job = JobPost(
        org=org,
        title=title,
        description=description,
        engagement_type=engagement_type,
        location_type=location_type,
        **fields,
    )
    job.mark_open()
    job.save()

    for comp in compensation_kinds:
        JobCompensation.objects.create(job=job, kind=comp["kind"], detail=comp.get("detail", ""))

    return job


@transaction.atomic
def update_job(job, *, compensation_kinds=None, **fields):
    for key, value in fields.items():
        setattr(job, key, value)
    job.save()

    if compensation_kinds is not None:
        job.compensation.all().delete()
        for comp in compensation_kinds:
            JobCompensation.objects.create(job=job, kind=comp["kind"], detail=comp.get("detail", ""))

    return job


def close_job(job) -> None:
    job.status = JobPost.Status.CLOSED
    job.save(update_fields=["status"])


@transaction.atomic
def renew_job(job) -> JobPost:
    """One-click renewal (spec §3b) — reopens a job regardless of whether it
    was manually closed or auto-expired, and resets the TTL clock."""
    job.mark_open()
    job.renewed_at = timezone.now()
    job.renewal_count += 1
    job.save(update_fields=["status", "expires_at", "renewed_at", "renewal_count"])
    return job


@transaction.atomic
def apply_to_job(job: JobPost, applicant, *, note: str = "", external_link: str = "") -> Application:
    if job.status != JobPost.Status.OPEN:
        raise ValidationError({"job": "This job is not accepting applications."})
    if is_org_member(job.org, applicant):
        raise PermissionDenied("You can't apply to your own organization's job.")
    if Application.objects.filter(job=job, applicant=applicant).exists():
        raise ValidationError({"job": "You've already applied to this job."})

    enforce_rate_limit(
        f"job-application:{applicant.id}", limit=DAILY_APPLICATION_LIMIT, window_seconds=86400
    )

    application = Application.objects.create(
        job=job, applicant=applicant, note=note, external_link=external_link
    )

    applicant_name = _display_name(applicant)
    for admin in org_admins(job.org):
        notify(
            admin,
            kind=Notification.Kind.JOB_APPLICATION,
            aggregate_key=f"job_application:{application.id}",
            title="New application",
            body=f"{applicant_name} applied to {job.title}.",
            link=f"/dashboard/{job.org.slug}",
        )
    return application


@transaction.atomic
def set_application_status(application: Application, new_status: str, by) -> Application:
    if not is_org_owner_or_admin(application.job.org, by):
        raise PermissionDenied("Only an org owner or admin can update this application.")
    if new_status not in Application.Status.values:
        raise ValidationError({"status": "Invalid status."})

    was_interested = application.status == Application.Status.INTERESTED
    application.status = new_status
    application.save(update_fields=["status"])

    if new_status == Application.Status.INTERESTED and not was_interested:
        conversation = get_or_create_org_conversation(application.job.org, application.applicant)
        if application.note:
            send_org_message(conversation, application.applicant, application.note)
        notify(
            application.applicant,
            kind=Notification.Kind.APPLICATION_INTEREST,
            aggregate_key=f"application_interest:{application.id}",
            title="An organization is interested",
            body=f"{application.job.org.name} is interested in your application for {application.job.title}.",
            link="/messages",
        )
    return application


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]
