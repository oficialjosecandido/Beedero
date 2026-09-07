from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from messaging.models import OrgConversation
from notifications.models import Notification
from orgs.models import Organization, OrgMembership

from .models import Application, CompensationKind, EngagementType, JobPost
from .management.commands.expire_jobs import Command as ExpireJobsCommand
from .services import apply_to_job, create_job, renew_job, set_application_status


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", email="owner@example.com", password="x")


@pytest.fixture
def candidate(db):
    return User.objects.create_user(username="candidate", email="candidate@example.com", password="x")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


@pytest.fixture
def draft_org(db, owner):
    org = Organization.objects.create(slug="draftco", name="DraftCo", status=Organization.Status.DRAFT)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


def _job_kwargs(**overrides):
    kwargs = dict(
        title="Founding engineer",
        description="Build stuff.",
        engagement_type=EngagementType.FULL_TIME,
        location_type=JobPost.LocationType.REMOTE,
        compensation_kinds=[],
    )
    kwargs.update(overrides)
    return kwargs


@pytest.mark.django_db
def test_create_job_requires_live_org(draft_org):
    with pytest.raises(ValidationError):
        create_job(draft_org, created_by=None, **_job_kwargs())


@pytest.mark.django_db
def test_create_job_publishes_immediately_with_ttl(org):
    job = create_job(org, created_by=None, **_job_kwargs())
    assert job.status == JobPost.Status.OPEN
    assert job.expires_at is not None
    assert job.expires_at > timezone.now()


@pytest.mark.django_db
def test_create_job_enforces_daily_post_limit(org):
    for _ in range(10):
        create_job(org, created_by=None, **_job_kwargs())
    with pytest.raises(Exception):
        create_job(org, created_by=None, **_job_kwargs())


@pytest.mark.django_db
def test_create_job_persists_multiple_compensation_components(org):
    job = create_job(
        org,
        created_by=None,
        **_job_kwargs(
            compensation_kinds=[
                {"kind": CompensationKind.SALARY, "detail": "€50k-60k"},
                {"kind": CompensationKind.EQUITY, "detail": "0.5%-1%"},
            ]
        ),
    )
    kinds = set(job.compensation.values_list("kind", flat=True))
    assert kinds == {CompensationKind.SALARY, CompensationKind.EQUITY}


@pytest.mark.django_db
def test_volunteer_job_can_publish_with_no_compensation(org):
    job = create_job(org, created_by=None, **_job_kwargs(engagement_type=EngagementType.VOLUNTEER))
    assert job.status == JobPost.Status.OPEN
    assert job.compensation.count() == 0


@pytest.mark.django_db
def test_apply_requires_open_job(org, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    job.status = JobPost.Status.CLOSED
    job.save(update_fields=["status"])
    with pytest.raises(ValidationError):
        apply_to_job(job, candidate)


@pytest.mark.django_db
def test_apply_rejects_own_org_member(org, owner):
    job = create_job(org, created_by=None, **_job_kwargs())
    with pytest.raises(PermissionDenied):
        apply_to_job(job, owner)


@pytest.mark.django_db
def test_apply_creates_notification_for_admins(org, owner, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    apply_to_job(job, candidate, note="Hi!")
    assert Notification.objects.filter(user=owner, kind=Notification.Kind.JOB_APPLICATION).exists()


@pytest.mark.django_db
def test_apply_rejects_duplicate_application(org, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    apply_to_job(job, candidate)
    with pytest.raises(ValidationError):
        apply_to_job(job, candidate)


@pytest.mark.django_db
def test_apply_enforces_daily_rate_limit(owner, candidate):
    # Each job lives in its own org so the job-post daily cap (10/day) never
    # interferes with the application cap (30/day) being tested here.
    def _job_in_new_org(i):
        job_org = Organization.objects.create(
            slug=f"org-{i}", name=f"Org {i}", status=Organization.Status.LIVE
        )
        OrgMembership.objects.create(org=job_org, user=owner, role=OrgMembership.Role.OWNER)
        return create_job(job_org, created_by=None, **_job_kwargs(title=f"Job {i}"))

    for i in range(30):
        apply_to_job(_job_in_new_org(i), candidate)
    extra = _job_in_new_org(30)
    with pytest.raises(Exception):
        apply_to_job(extra, candidate)


@pytest.mark.django_db
def test_application_endpoint_rejects_duplicate_as_400_not_500(api, org, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    api.force_authenticate(candidate)
    first = api.post(f"/api/jobs/{job.id}/apply/", {"note": "Hi"}, format="json")
    assert first.status_code == 201
    second = api.post(f"/api/jobs/{job.id}/apply/", {"note": "Hi again"}, format="json")
    assert second.status_code == 400


@pytest.mark.django_db
def test_set_application_status_interested_opens_conversation_with_note(org, owner, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    application = apply_to_job(job, candidate, note="I'd love to help.")
    set_application_status(application, Application.Status.INTERESTED, owner)

    conversation = OrgConversation.objects.get(org=org, external_user=candidate)
    first_message = conversation.messages.order_by("created_at").first()
    assert first_message.body == "I'd love to help."
    assert first_message.sender_id == candidate.id
    assert Notification.objects.filter(
        user=candidate, kind=Notification.Kind.APPLICATION_INTEREST
    ).exists()


@pytest.mark.django_db
def test_set_application_status_requires_org_admin(org, candidate):
    job = create_job(org, created_by=None, **_job_kwargs())
    application = apply_to_job(job, candidate)
    with pytest.raises(PermissionDenied):
        set_application_status(application, Application.Status.INTERESTED, candidate)


@pytest.mark.django_db
def test_renew_job_reopens_closed_job_and_resets_ttl(org):
    job = create_job(org, created_by=None, **_job_kwargs())
    job.status = JobPost.Status.CLOSED
    job.expires_at = timezone.now() - timedelta(days=1)
    job.save(update_fields=["status", "expires_at"])

    renewed = renew_job(job)
    assert renewed.status == JobPost.Status.OPEN
    assert renewed.expires_at > timezone.now()
    assert renewed.renewal_count == 1


@pytest.mark.django_db
def test_expire_jobs_command_closes_past_due_jobs(org):
    job = create_job(org, created_by=None, **_job_kwargs())
    JobPost.objects.filter(pk=job.pk).update(expires_at=timezone.now() - timedelta(hours=1))

    ExpireJobsCommand().handle()

    job.refresh_from_db()
    assert job.status == JobPost.Status.CLOSED


@pytest.mark.django_db
def test_expire_jobs_command_sends_one_warning_per_job_no_duplicates_on_rerun(org, owner):
    job = create_job(org, created_by=None, **_job_kwargs())
    JobPost.objects.filter(pk=job.pk).update(expires_at=timezone.now() + timedelta(hours=1))

    ExpireJobsCommand().handle()
    ExpireJobsCommand().handle()

    count = Notification.objects.filter(
        user=owner, kind=Notification.Kind.JOB_EXPIRING, aggregate_key=f"job_expiring:{job.id}:0"
    ).count()
    assert count == 1


@pytest.mark.django_db
def test_discovery_endpoint_only_lists_open_jobs(api, org, candidate):
    open_job = create_job(org, created_by=None, **_job_kwargs(title="Open role"))
    closed_job = create_job(org, created_by=None, **_job_kwargs(title="Closed role"))
    closed_job.status = JobPost.Status.CLOSED
    closed_job.save(update_fields=["status"])

    api.force_authenticate(candidate)
    res = api.get("/api/jobs/")
    assert res.status_code == 200
    titles = [item["title"] for item in res.data["items"]]
    assert "Open role" in titles
    assert "Closed role" not in titles
    assert open_job.id in [item["id"] for item in res.data["items"]]
