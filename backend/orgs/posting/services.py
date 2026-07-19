"""Create, update, and inspect org posts."""

from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from credibility.levels import credibility_level
from orgs.constants import SectionKind
from orgs.models import Activity, OrgSection
from orgs.services import create_activity

from .constants import ACTIVITY_TO_POST_KIND, POST_KIND_TO_ACTIVITY, PostKind
from .freshness import freshness_label
from .gates import locked_kinds, posting_rule
from .limits import DAILY_LIMIT_MESSAGE, can_post_now
from .payloads import validate_payload


class PostingLimitExceeded(APIException):
    status_code = 429
    default_detail = DAILY_LIMIT_MESSAGE


def _activity_kind_to_post_kind(kind: str) -> str | None:
    return ACTIVITY_TO_POST_KIND.get(kind)


def posting_status(org) -> dict:
    rule = posting_rule(org)
    allowed, next_slot = can_post_now(org, rule["min_days_between"])
    return {
        "can_post": allowed,
        "next_slot_at": next_slot.isoformat() if next_slot else None,
        "allowed_kinds": sorted(rule["kinds"]),
        "locked_kinds": locked_kinds(org),
        "credibility_level": credibility_level(org),
        "freshness": freshness_label(org),
    }


def _section_for_kind(org, activity_kind: str) -> OrgSection:
    return OrgSection.objects.get(org=org, kind=activity_kind)


def create_org_post(org, kind: str, data: dict) -> Activity:
    rule = posting_rule(org)
    if kind not in rule["kinds"]:
        locked = next((item for item in locked_kinds(org) if item["kind"] == kind), None)
        detail = locked["reason"] if locked else "This post type is not available at your credibility level."
        raise ValidationError({"kind": detail})

    allowed, next_slot = can_post_now(org, rule["min_days_between"])
    if not allowed:
        exc = PostingLimitExceeded()
        if next_slot:
            exc.detail = {"detail": DAILY_LIMIT_MESSAGE, "next_slot_at": next_slot.isoformat()}
        raise exc

    validated = validate_payload(kind, data)
    activity_kind = POST_KIND_TO_ACTIVITY[kind]
    section = _section_for_kind(org, activity_kind)
    now = timezone.now()

    if kind == PostKind.UPDATE:
        title = validated.get("title") or validated["body"][:120]
        return create_activity(
            org=org,
            kind=activity_kind,
            title=title,
            body=validated["body"],
            occurred_at=now,
            image=validated.get("image"),
            visibility=section.visibility,
            payload={},
        )

    if kind == PostKind.MILESTONE:
        display_date = validated.get("occurred_at")
        payload = {"category": validated["category"]}
        if display_date:
            payload["occurred_at"] = display_date.isoformat()
        return create_activity(
            org=org,
            kind=activity_kind,
            title=validated["title"],
            body=validated.get("body", ""),
            occurred_at=now,
            image=None,
            visibility=section.visibility,
            payload=payload,
        )

    # Event
    payload = {
        "format": validated["format"],
        "location": validated.get("location", ""),
        "registration_url": validated.get("registration_url", ""),
    }
    return create_activity(
        org=org,
        kind=activity_kind,
        title=validated["title"],
        body=validated.get("body", ""),
        occurred_at=validated["starts_at"],
        ends_at=validated["ends_at"],
        image=validated.get("image"),
        visibility=section.visibility,
        payload=payload,
    )


def update_org_post(activity: Activity, kind: str, data: dict) -> Activity:
    if _activity_kind_to_post_kind(activity.kind) != kind:
        raise ValidationError({"kind": "Post kind cannot be changed."})

    validated = validate_payload(kind, data)
    now = timezone.now()

    if kind == PostKind.UPDATE:
        activity.title = validated.get("title") or validated["body"][:120]
        activity.body = validated["body"]
        if validated.get("image"):
            activity.image = validated["image"]
    elif kind == PostKind.MILESTONE:
        activity.title = validated["title"]
        activity.body = validated.get("body", "")
        payload = dict(activity.payload or {})
        payload["category"] = validated["category"]
        if validated.get("occurred_at"):
            payload["occurred_at"] = validated["occurred_at"].isoformat()
        elif "occurred_at" in payload:
            payload.pop("occurred_at")
        activity.payload = payload
    else:
        activity.title = validated["title"]
        activity.body = validated.get("body", "")
        activity.occurred_at = validated["starts_at"]
        activity.ends_at = validated["ends_at"]
        activity.payload = {
            "format": validated["format"],
            "location": validated.get("location", ""),
            "registration_url": validated.get("registration_url", ""),
        }
        if validated.get("image"):
            activity.image = validated["image"]

    activity.save()
    return activity


def activity_post_summary(activity: Activity) -> dict:
    post_kind = _activity_kind_to_post_kind(activity.kind)
    value = {
        "title": activity.title,
        "body": activity.body,
        "image": activity.image.url if activity.image else None,
        "occurred_at": activity.occurred_at.isoformat(),
        "ends_at": activity.ends_at.isoformat() if activity.ends_at else None,
    }
    if activity.payload:
        value["payload"] = activity.payload
    return {
        "id": activity.id,
        "kind": post_kind or activity.kind,
        "value": value,
        "created_at": activity.created_at.isoformat(),
    }


def upcoming_events(org, limit=5):
    now = timezone.now()
    activities = (
        Activity.objects.filter(org=org, kind=SectionKind.EVENTS, ends_at__gt=now)
        .order_by("occurred_at")[:limit]
    )
    return [activity_post_summary(a) for a in activities]
