from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from orgs.models import Activity, OrgMembership
from orgs.visibility import activity_visible_to

from .models import Notification, NotificationPreference
from .push import send_push

User = get_user_model()

AGGREGATION_WINDOW = timedelta(hours=6)
PROFILE_VIEW_WINDOW = timedelta(days=7)

# Kinds gated by NotificationPreference.inapp_engagement — everything else
# (verification, milestone) is treated as important/transactional-ish and
# always delivered, mirroring the "no per-notification email, but also no
# silently-dropped account-critical update" split in doc §2/§6.
_ENGAGEMENT_KINDS = {
    Notification.Kind.REACTION,
    Notification.Kind.COMMENT,
    Notification.Kind.FOLLOWER,
    Notification.Kind.INTEREST,
    Notification.Kind.PROFILE_VIEWS,
    Notification.Kind.PIPELINE,
    Notification.Kind.MENTION,
}


def _activity_recipients(activity: Activity):
    if activity.author_id:
        return [activity.author]
    if activity.org_id:
        return list(
            User.objects.filter(
                orgmembership__org_id=activity.org_id,
                orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
            ).distinct()
        )
    return []


def _wants_engagement_notifications(user) -> bool:
    pref = NotificationPreference.objects.filter(user=user).first()
    return pref is None or pref.inapp_engagement


def _wants_push_notifications(user) -> bool:
    pref = NotificationPreference.objects.filter(user=user).first()
    return pref is None or pref.push_enabled


def notify(
    user,
    *,
    kind: str,
    aggregate_key: str,
    title: str,
    body: str,
    link: str = "",
):
    if user is None:
        return
    if kind in _ENGAGEMENT_KINDS and not _wants_engagement_notifications(user):
        return
    cutoff = timezone.now() - AGGREGATION_WINDOW
    existing = (
        Notification.objects.filter(
            user=user,
            aggregate_key=aggregate_key,
            read_at__isnull=True,
            updated_at__gte=cutoff,
        )
        .order_by("-updated_at")
        .first()
    )
    if existing:
        existing.title = title
        existing.body = body
        existing.link = link or existing.link
        existing.save(update_fields=["title", "body", "link", "updated_at"])
        return existing

    created = Notification.objects.create(
        user=user,
        kind=kind,
        aggregate_key=aggregate_key,
        title=title,
        body=body,
        link=link,
    )
    if _wants_push_notifications(user):
        send_push(user, title=title, body=body, link=link)
    return created


def notify_activity_reaction(activity: Activity, actor, reaction_count: int):
    for recipient in _activity_recipients(activity):
        if recipient.id == actor.id:
            continue
        actor_name = _display_name(actor)
        if reaction_count <= 1:
            body = f"{actor_name} reacted to your update."
        else:
            body = f"{actor_name} and others reacted to your update ({reaction_count} reactions)."
        notify(
            recipient,
            kind=Notification.Kind.REACTION,
            aggregate_key=f"reaction:{activity.id}",
            title="New reaction",
            body=body,
            link=_activity_link(activity),
        )


def notify_activity_comment(activity: Activity, actor, comment_count: int):
    for recipient in _activity_recipients(activity):
        if recipient.id == actor.id:
            continue
        actor_name = _display_name(actor)
        if comment_count <= 1:
            body = f"{actor_name} commented on your update."
        else:
            body = f"{actor_name} and others commented on your update ({comment_count} comments)."
        notify(
            recipient,
            kind=Notification.Kind.COMMENT,
            aggregate_key=f"comment:{activity.id}",
            title="New comment",
            body=body,
            link=_activity_link(activity),
        )


def notify_mention(mention, actor):
    """Fired once per resolved Mention row (social/mentions.py). Per spec:
    mentioning someone never grants access to restricted content, so this
    only notifies a recipient who could already see the underlying post —
    same activity_visible_to() check the comment/reaction feed uses."""
    from messaging.services import is_blocked

    container = mention.activity or mention.comment.activity
    actor_name = _display_name(actor)
    in_comment = mention.comment_id is not None

    if mention.target_user_id:
        recipient = mention.target_user
        if recipient.id == actor.id:
            return
        if is_blocked(actor, recipient):
            return
        if not activity_visible_to(recipient, container):
            return
        notify(
            recipient,
            kind=Notification.Kind.MENTION,
            aggregate_key=f"mention:{mention.id}",
            title="You were mentioned",
            body=(
                f"{actor_name} mentioned you in a comment."
                if in_comment
                else f"{actor_name} mentioned you in a post."
            ),
            link=_activity_link(container),
        )
        return

    org = mention.target_org
    admins = User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()
    for admin in admins:
        if admin.id == actor.id:
            continue
        if is_blocked(actor, admin):
            continue
        if not activity_visible_to(admin, container):
            continue
        notify(
            admin,
            kind=Notification.Kind.MENTION,
            aggregate_key=f"mention:{mention.id}:{admin.id}",
            title="Your org was mentioned",
            body=(
                f"{actor_name} mentioned {org.name} in a comment."
                if in_comment
                else f"{actor_name} mentioned {org.name} in a post."
            ),
            link=_activity_link(container),
        )


def notify_org_followed(org, actor):
    owners = User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()
    actor_name = _display_name(actor)
    for owner in owners:
        if owner.id == actor.id:
            continue
        notify(
            owner,
            kind=Notification.Kind.FOLLOWER,
            aggregate_key=f"follow:{org.id}",
            title="New follower",
            body=f"{actor_name} started following {org.name}.",
            link=f"/dashboard/{org.slug}",
        )


def notify_interest_signal(org, actor, kind: str):
    owners = User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()
    label = kind.replace("_", " ")
    for owner in owners:
        if owner.id == actor.id:
            continue
        notify(
            owner,
            kind=Notification.Kind.INTEREST,
            aggregate_key=f"interest:{org.id}:{kind}",
            title="Investor interest",
            body=f"An investor showed interest in {org.name} ({label}).",
            link=f"/dashboard/{org.slug}",
        )


def notify_verification_update(org, message: str):
    owners = User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()
    for owner in owners:
        notify(
            owner,
            kind=Notification.Kind.VERIFICATION,
            aggregate_key=f"verification:{org.id}:{timezone.now().date().isoformat()}",
            title=f"{org.name} verification update",
            body=message,
            link=f"/dashboard/{org.slug}",
        )


def notify_profile_views(org, view_count: int):
    owners = User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()
    cutoff = timezone.now() - PROFILE_VIEW_WINDOW
    for owner in owners:
        existing = Notification.objects.filter(
            user=owner,
            kind=Notification.Kind.PROFILE_VIEWS,
            aggregate_key=f"profile_views:{org.id}",
            created_at__gte=cutoff,
        ).exists()
        if existing:
            continue
        notify(
            owner,
            kind=Notification.Kind.PROFILE_VIEWS,
            aggregate_key=f"profile_views:{org.id}",
            title="Profile activity",
            body=f"Your organization profile had {view_count} visits this week.",
            link=f"/dashboard/{org.slug}",
        )


def notify_milestone(
    user,
    *,
    aggregate_key: str,
    title: str,
    body: str,
    link: str = "",
    suggestion_title: str = "",
    suggestion_body: str = "",
):
    """Fires at most once ever per `aggregate_key` (unlike `notify()`, which
    only dedupes within the 6h aggregation window) — a milestone must not
    refire on every subsequent event. Never gated by `inapp_engagement`:
    it's a rare, celebratory, user-initiated-adjacent event, not noise."""
    if user is None:
        return None
    if Notification.objects.filter(
        user=user, kind=Notification.Kind.MILESTONE, aggregate_key=aggregate_key
    ).exists():
        return None
    created = Notification.objects.create(
        user=user,
        kind=Notification.Kind.MILESTONE,
        aggregate_key=aggregate_key,
        title=title,
        body=body,
        link=link,
        payload={"suggestion_title": suggestion_title, "suggestion_body": suggestion_body},
    )
    if _wants_push_notifications(user):
        send_push(user, title=title, body=body, link=link)
    return created


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]


def _activity_link(activity: Activity) -> str:
    if activity.org_id:
        return f"/dashboard/{activity.org.slug}"
    return "/feed"
