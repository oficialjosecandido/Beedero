"""Posts: everything public, newest first, and the one moderation action
staff have — remove, with a reason the author is told. Admins can restore.

Staff see what any visitor sees: public posts and personal posts. Posts an
organisation shares only with its members stay private to it (row-level
security), here as everywhere else.
"""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

import sentry_sdk

from beedero.email_brand import frontend_url, wrap_email
from notifications.models import Notification
from notifications.services import notify
from orgs.models import Activity, OrgMembership, Visibility

from . import audit
from .access import IsNexusStaff, nexus_role, require
from .common import file_url, iso, paginate, person
from .models import NexusAction

# Each reason maps to the Terms of Service (§6, prohibited conduct).
REASONS = {
    "spam": "Spam or repeated content",
    "misleading": "False or misleading information",
    "harassment": "Harassment or abuse",
    "inappropriate": "Inappropriate content",
    "advertising": "Advertising unrelated to the person or company",
    "privacy": "Someone else's private information",
    "other": "Breaks the Terms of Service",
}


def _row(post: Activity) -> dict:
    return {
        "id": post.id,
        "kind": post.kind,
        "title": post.title,
        "body": post.body[:600],
        "image": file_url(post.image),
        "created_at": iso(post.created_at),
        "visibility": post.visibility,
        "org": {"slug": post.org.slug, "name": post.org.name, "logo": file_url(post.org.logo)} if post.org_id else None,
        "author": person(post.author),
        "reactions": post.reaction_count,
        "comments": post.comment_count,
        "impressions": post.feed_impression_count,
        "removed": {
            "at": iso(post.removed_at),
            "by": post.removed_by.email if post.removed_by_id else "",
            "reason": post.removal_reason,
            "reason_label": REASONS.get(post.removal_reason, post.removal_reason),
        }
        if post.removed_at
        else None,
        "public_url": _public_url(post),
    }


def _public_url(post: Activity) -> str | None:
    if post.org_id:
        return f"/o/{post.org.slug}"
    profile = getattr(post.author, "investorprofile", None) if post.author_id else None
    return f"/p/{profile.handle}" if profile and profile.handle else None


class PostsView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request):
        queryset = (
            Activity.all_objects.filter(Q(visibility=Visibility.PUBLIC) | Q(org__isnull=True))
            .select_related("org", "author__investorprofile", "removed_by")
            .order_by("-created_at", "-id")
        )
        state = request.query_params.get("state", "live")
        queryset = (
            queryset.filter(removed_at__isnull=False) if state == "removed" else queryset.filter(removed_at__isnull=True)
        )
        scope = request.query_params.get("scope")
        if scope == "orgs":
            queryset = queryset.filter(org__isnull=False)
        elif scope == "people":
            queryset = queryset.filter(org__isnull=True)
        kind = request.query_params.get("kind")
        if kind in Activity.Kind.values:
            queryset = queryset.filter(kind=kind)
        q = (request.query_params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q)
                | Q(body__icontains=q)
                | Q(org__name__icontains=q)
                | Q(author__email__icontains=q)
                | Q(author__investorprofile__full_name__icontains=q)
            )
        rows, page = paginate(queryset, request)
        return Response(
            {
                "results": [_row(post) for post in rows],
                "reasons": [{"key": key, "label": label} for key, label in REASONS.items()],
                "can_restore": nexus_role(request.user) == "admin",
                **page,
            }
        )


def _people_to_tell(post: Activity):
    """The author; for an organisation post with no author, its owners."""
    if post.author_id:
        return [post.author]
    return [
        m.user
        for m in OrgMembership.objects.filter(
            org_id=post.org_id, role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
        ).select_related("user")
    ]


def _tell_removed(post: Activity, reason: str) -> None:
    label = REASONS[reason]
    title = "A post was removed"
    body = (
        f'Your post "{post.title}" was removed by Beedero: {label}. '
        "If you think this is a mistake, reply to this email."
    )
    for user in _people_to_tell(post):
        notify(
            user,
            kind=Notification.Kind.MODERATION,
            aggregate_key=f"moderation:post:{post.id}",
            title=title,
            body=body,
            link="/terms",
        )
        html = wrap_email(
            eyebrow="Moderation",
            title=title,
            body_html=f"<p style='margin:0;font-size:15px;line-height:1.6'>{escape(body)}</p>",
            cta_label="Read the Terms",
            cta_href=frontend_url("terms"),
        )
        message = EmailMultiAlternatives(f"Beedero — {title}", body, settings.DEFAULT_FROM_EMAIL, [user.email])
        message.attach_alternative(html, "text/html")
        try:
            message.send()
        except Exception as exc:
            sentry_sdk.capture_exception(exc)


class PostActionView(APIView):
    permission_classes = [IsNexusStaff]

    def post(self, request, pk, action):
        post = get_object_or_404(
            Activity.all_objects.select_related("org", "author__investorprofile", "removed_by"), pk=pk
        )
        if action == "remove":
            reason = request.data.get("reason")
            if reason not in REASONS:
                raise ValidationError({"reason": ["Choose a reason."]})
            note = (request.data.get("note") or "").strip()[:300]
            if post.removed_at is None:
                post.removed_at = timezone.now()
                post.removed_by = request.user
                post.removal_reason = reason
                post.save(update_fields=["removed_at", "removed_by", "removal_reason"])
                audit.record(
                    request.user,
                    NexusAction.Action.POST_REMOVED,
                    target_type="post",
                    target_id=post.id,
                    label=post.title,
                    reason=f"{REASONS[reason]}{' — ' + note if note else ''}",
                    org=post.org.slug if post.org_id else None,
                    author=post.author_id,
                )
                _tell_removed(post, reason)
        elif action == "restore":
            require(request.user, "posts.restore")
            if post.removed_at is not None:
                post.removed_at = None
                post.removed_by = None
                post.removal_reason = ""
                post.save(update_fields=["removed_at", "removed_by", "removal_reason"])
                audit.record(
                    request.user,
                    NexusAction.Action.POST_RESTORED,
                    target_type="post",
                    target_id=post.id,
                    label=post.title,
                    reason=(request.data.get("note") or "").strip()[:300],
                )
        else:
            return Response(status=404)
        return Response(_row(post))
