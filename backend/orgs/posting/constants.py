"""Org post kinds — API surface vs Activity storage."""

from django.db import models

from orgs.constants import SectionKind


class PostKind(models.TextChoices):
    UPDATE = "update"
    MILESTONE = "milestone"
    EVENT = "event"


POST_KIND_TO_ACTIVITY = {
    PostKind.UPDATE: SectionKind.NEWS,
    PostKind.MILESTONE: SectionKind.MILESTONES,
    PostKind.EVENT: SectionKind.EVENTS,
}

ACTIVITY_TO_POST_KIND = {value: key for key, value in POST_KIND_TO_ACTIVITY.items()}

ALL_POST_KINDS = frozenset(PostKind.values)

LOCK_MESSAGES = {
    PostKind.MILESTONE: "Milestones unlock at credibility level 1 — verify your organization's compliance.",
    PostKind.EVENT: "Events unlock at credibility level 2 — verify your organization's compliance.",
}

UNLOCK_LEVEL = {
    PostKind.UPDATE: 0,
    PostKind.MILESTONE: 1,
    PostKind.EVENT: 2,
}
