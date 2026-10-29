"""People: find anyone, see their whole picture, and — admins — suspend,
reactivate, mark as internal or give Beedero's own verification."""

from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

import sentry_sdk

from accounts.ladder import verification_ladder, with_unlock
from accounts.models import InvestorProfile, User
from affiliations.models import Affiliation
from analytics.models import UserActiveDay
from beedero.email_brand import wrap_email
from billing.access import org_billing_state
from jobs.models import Application
from messaging.models import MessageReport
from orgs.models import Activity, OrgMembership

from . import audit
from .access import IsNexusStaff, nexus_role, require
from .common import file_url, iso, paginate, person, required_reason
from .models import NexusAction

FILTERS = {
    "all": Q(),
    "new": None,  # joined in the last 7 days — needs "now"
    "active": None,
    "dormant": None,
    "founders": Q(orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]),
    "investors": Q(investorprofile__intents__contains=["invest"]),
    "suspended": Q(is_active=False),
    "internal": Q(is_internal=True),
    "staff": Q(is_staff=True),
}


def _filtered(queryset, key: str, now):
    if key == "new":
        return queryset.filter(date_joined__gte=now - timedelta(days=7))
    if key == "active":
        return queryset.filter(last_seen_at__gte=now - timedelta(days=7))
    if key == "dormant":
        return queryset.filter(Q(last_seen_at__lt=now - timedelta(days=30)) | Q(last_seen_at__isnull=True))
    if key == "discover":
        return queryset.filter(id__in=with_unlock(InvestorProfile.objects.all()).values("user_id"))
    return queryset.filter(FILTERS.get(key, Q())).distinct()


def _row(user, in_discover: set) -> dict:
    profile = getattr(user, "investorprofile", None)
    return {
        **person(user),
        "headline": profile.headline if profile else "",
        "joined_at": iso(user.date_joined),
        "last_seen_at": iso(user.last_seen_at),
        "email_verified": user.email_verified_at is not None,
        "in_discover": user.id in in_discover,
        "orgs": user.orgs_n,
        "intents": profile.intents if profile else [],
        "is_active": user.is_active,
        "is_internal": user.is_internal,
        "is_staff": user.is_staff,
        "beedero_verified": bool(profile and profile.is_verified),
        "signup_source": user.signup_source,
    }


class UsersView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request):
        now = timezone.now()
        queryset = User.objects.select_related("investorprofile").annotate(orgs_n=Count("orgmembership", distinct=True))
        q = (request.query_params.get("q") or "").strip()
        if q:
            match = (
                Q(email__icontains=q)
                | Q(investorprofile__full_name__icontains=q)
                | Q(investorprofile__handle__icontains=q.lstrip("@"))
            )
            if q.isdigit():
                match |= Q(id=int(q))
            queryset = queryset.filter(match)
        queryset = _filtered(queryset, request.query_params.get("filter", "all"), now)
        sort = request.query_params.get("sort", "joined")
        queryset = queryset.order_by(
            {"joined": "-date_joined", "seen": "-last_seen_at", "name": "investorprofile__full_name"}.get(
                sort, "-date_joined"
            ),
            "-id",
        )
        rows, page = paginate(queryset, request)
        in_discover = set(
            with_unlock(InvestorProfile.objects.filter(user_id__in=[u.id for u in rows])).values_list(
                "user_id", flat=True
            )
        )
        return Response({"results": [_row(user, in_discover) for user in rows], **page})


def _detail(user, viewer) -> dict:
    profile = getattr(user, "investorprofile", None)
    now = timezone.now()
    memberships = OrgMembership.objects.filter(user=user).select_related("org").order_by("org__name")
    reports = MessageReport.objects.filter(reported_user=user).order_by("-created_at")[:20]
    return {
        **person(user),
        "headline": profile.headline if profile else "",
        "city": profile.city if profile else "",
        "country": profile.country if profile else "",
        "joined_at": iso(user.date_joined),
        "last_seen_at": iso(user.last_seen_at),
        "email_verified_at": iso(user.email_verified_at),
        "signup_source": user.signup_source,
        "signup_ref": user.signup_ref,
        "intents": profile.intents if profile else [],
        "is_active": user.is_active,
        "is_internal": user.is_internal,
        "is_staff": user.is_staff,
        "beedero_verified": bool(profile and profile.is_verified),
        "discoverable_since": iso(profile.discoverable_since) if profile else None,
        "active_days_30": UserActiveDay.objects.filter(
            user=user, day__gte=(now - timedelta(days=30)).date()
        ).count(),
        "ladder": verification_ladder(profile) if profile else None,
        "orgs": [
            {
                "slug": m.org.slug,
                "name": m.org.name,
                "role": m.role,
                "status": m.org.status,
                "logo": file_url(m.org.logo),
                "plan": org_billing_state(m.org)["state"],
            }
            for m in memberships
        ],
        "affiliations": [
            {"org": a.org.name if a.org_id else "", "status": a.status, "title": getattr(a, "title", "")}
            for a in Affiliation.objects.filter(user=user).select_related("org")[:20]
        ],
        "counts": {
            "posts": Activity.objects.filter(author=user, org__isnull=True).count(),
            "posts_removed": Activity.all_objects.filter(author=user, removed_at__isnull=False).count(),
            "applications": Application.objects.filter(applicant=user).count(),
            "reports_filed": MessageReport.objects.filter(reporter=user).count(),
        },
        "reports_against": [
            {
                "id": r.id,
                "reason": r.get_reason_display(),
                "created_at": iso(r.created_at),
                "resolution": r.get_resolution_display() if r.resolution else "",
            }
            for r in reports
        ],
        "public_url": f"/p/{profile.handle}" if profile and profile.handle else None,
        "history": audit.history("user", user.id),
        "can_manage": nexus_role(viewer) == "admin",
    }


class UserView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request, pk):
        user = get_object_or_404(User.objects.select_related("investorprofile"), pk=pk)
        return Response(_detail(user, request.user))


def _tell(user, subject: str, text: str) -> None:
    html = wrap_email(
        eyebrow="Your account",
        title=subject,
        body_html=f"<p style='margin:0;font-size:15px;line-height:1.6'>{escape(text)}</p>",
    )
    message = EmailMultiAlternatives(f"Beedero — {subject}", text, settings.DEFAULT_FROM_EMAIL, [user.email])
    message.attach_alternative(html, "text/html")
    try:
        message.send()
    except Exception as exc:  # the action stands even if the email doesn't
        sentry_sdk.capture_exception(exc)


def suspend(user, actor, reason: str) -> None:
    if user.pk == actor.pk:
        raise ValidationError({"detail": "You can't suspend yourself."})
    if user.is_staff:
        raise ValidationError({"detail": "Remove staff access first (Django admin), then suspend."})
    if not user.is_active:
        return
    user.is_active = False
    user.save(update_fields=["is_active"])
    audit.record(actor, NexusAction.Action.USER_SUSPENDED, target_type="user", target_id=user.id, label=user.email, reason=reason)
    _tell(
        user,
        "Your account is suspended",
        "Your Beedero account has been suspended for breaking the Terms of Service. "
        "If you think this is a mistake, reply to this email.",
    )


class UserActionView(APIView):
    """POST /nexus/users/<id>/<action>/ — admins only."""

    permission_classes = [IsNexusStaff]

    def post(self, request, pk, action):
        require(request.user, "users.manage")
        user = get_object_or_404(User.objects.select_related("investorprofile"), pk=pk)
        if action == "suspend":
            suspend(user, request.user, required_reason(request))
        elif action == "reactivate":
            reason = required_reason(request)
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=["is_active"])
                audit.record(
                    request.user,
                    NexusAction.Action.USER_REACTIVATED,
                    target_type="user",
                    target_id=user.id,
                    label=user.email,
                    reason=reason,
                )
        elif action == "internal":
            value = bool(request.data.get("value"))
            user.is_internal = value
            user.save(update_fields=["is_internal"])
            audit.record(
                request.user, NexusAction.Action.USER_INTERNAL, target_type="user", target_id=user.id, label=user.email, value=value
            )
        elif action == "verify":
            profile = getattr(user, "investorprofile", None)
            if profile is None:
                raise ValidationError({"detail": "This person has no profile yet."})
            value = bool(request.data.get("value"))
            reason = required_reason(request)
            profile.is_verified = value
            profile.verified_at = timezone.now() if value else None
            profile.save(update_fields=["is_verified", "verified_at"])
            audit.record(
                request.user,
                NexusAction.Action.USER_VERIFIED,
                target_type="user",
                target_id=user.id,
                label=user.email,
                reason=reason,
                value=value,
            )
        else:
            return Response(status=404)
        user.refresh_from_db()
        return Response(_detail(user, request.user))
