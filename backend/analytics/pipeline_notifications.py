"""Notify investors tracking an org in their private pipeline."""

from django.conf import settings
from django.contrib.auth import get_user_model

from analytics.models import PipelineEntry
from notifications.services import notify

User = get_user_model()


def notify_pipeline_investors(org, *, title: str, body: str, link: str = ""):
    investor_ids = list(
        PipelineEntry.objects.filter(org=org)
        .exclude(stage=PipelineEntry.Stage.PASSED)
        .values_list("investor_id", flat=True)
        .distinct()
    )
    if not investor_ids:
        return
    frontend = settings.FRONTEND_URL.rstrip("/")
    resolved_link = link or f"{frontend}/org/{org.slug}"
    for user in User.objects.filter(id__in=investor_ids):
        notify(
            user,
            kind="pipeline",
            aggregate_key=f"pipeline:{org.id}",
            title=title,
            body=body,
            link=resolved_link,
        )


def notify_pipeline_new_post(org, activity):
    notify_pipeline_investors(
        org,
        title=f"{org.name} published an update",
        body=activity.title or "New activity on a startup in your pipeline.",
    )
