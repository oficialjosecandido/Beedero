"""Organisations: find any, see members, ladder, plan, verifications and
history; admins can give a complimentary plan, extend a free period and
change Beedero's own verification."""

from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import ProfileView
from billing.access import access_q, org_billing_state
from billing.models import PaidInvoice, Subscription
from billing.subscriptions import grant_comp
from credibility.models import Verification
from jobs.models import JobPost
from orgs.ladder import listed_in_discover, org_verification_ladder
from orgs.models import Activity, Organization, OrgMembership

from . import audit
from .access import IsNexusStaff, nexus_role, require
from .common import file_url, iso, paginate, person, required_reason
from .models import NexusAction


def _stripe(org_ref="pk"):
    return Subscription.objects.filter(org_id=OuterRef(org_ref)).exclude(provider_ref="")


def _filtered(queryset, key: str, now):
    has_plan = Exists(Subscription.objects.filter(access_q(now), org_id=OuterRef("pk")))
    if key == "live":
        return queryset.filter(status=Organization.Status.LIVE)
    if key == "draft":
        return queryset.filter(status=Organization.Status.DRAFT)
    if key == "listed":
        return listed_in_discover(queryset)
    if key == "hidden":  # live but not in Discover
        return queryset.filter(status=Organization.Status.LIVE).exclude(
            pk__in=listed_in_discover(Organization.objects.all()).values("pk")
        )
    if key == "paying":
        return queryset.filter(
            Exists(_stripe().filter(status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE]))
        )
    if key == "free_year":
        return queryset.filter(
            Exists(
                Subscription.objects.filter(
                    org_id=OuterRef("pk"), provider_ref="", status=Subscription.Status.TRIALING, trial_end__gt=now
                )
            )
        )
    if key == "past_due":
        return queryset.filter(Exists(_stripe().filter(status=Subscription.Status.PAST_DUE)))
    if key == "no_plan":
        return queryset.exclude(has_plan)
    if key == "verified":
        return queryset.filter(is_verified=True)
    return queryset


def _owner(org):
    membership = (
        OrgMembership.objects.filter(org=org, role=OrgMembership.Role.OWNER).select_related("user__investorprofile").first()
    )
    return person(membership.user) if membership else None


def _row(org, listed: set) -> dict:
    billing = org_billing_state(org)
    return {
        "slug": org.slug,
        "name": org.name,
        "logo": file_url(org.logo),
        "one_liner": org.one_liner,
        "status": org.status,
        "created_at": iso(org.created_at),
        "members": org.members_n,
        "followers": org.followers_n,
        "listed": org.pk in listed,
        "is_verified": org.is_verified,
        "plan": billing["state"],
        "plan_until": billing["until"],
        "owner": _owner(org),
    }


class OrgsView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request):
        now = timezone.now()
        queryset = Organization.objects.annotate(
            members_n=Count("members", distinct=True), followers_n=Count("followers", distinct=True)
        )
        q = (request.query_params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(slug__icontains=q) | Q(one_liner__icontains=q))
        queryset = _filtered(queryset, request.query_params.get("filter", "all"), now)
        queryset = queryset.order_by("-created_at", "-id")
        rows, page = paginate(queryset, request)
        listed = set(listed_in_discover(Organization.objects.filter(pk__in=[o.pk for o in rows])).values_list("pk", flat=True))
        return Response({"results": [_row(org, listed) for org in rows], **page})


def _detail(org, viewer) -> dict:
    now = timezone.now()
    members = OrgMembership.objects.filter(org=org).select_related("user__investorprofile").order_by("role", "id")
    subscriptions = Subscription.objects.filter(org=org).select_related("promo_code").order_by("-created_at", "-id")
    listed = listed_in_discover(Organization.objects.filter(pk=org.pk)).exists()
    return {
        "slug": org.slug,
        "name": org.name,
        "logo": file_url(org.logo),
        "one_liner": org.one_liner,
        "status": org.status,
        "stage": org.stage,
        "sector": org.sector,
        "geo": org.geo,
        "created_at": iso(org.created_at),
        "discoverable_since": iso(org.discoverable_since),
        "is_verified": org.is_verified,
        "listed": listed,
        "public_url": f"/o/{org.slug}" if org.status == Organization.Status.LIVE else None,
        "members": [{**person(m.user), "role": m.role, "title": m.title} for m in members],
        "ladder": org_verification_ladder(org),
        "billing": org_billing_state(org),
        "subscriptions": [
            {
                "plan": s.plan,
                "status": s.status,
                "source": s.source,
                "managed_by_stripe": bool(s.provider_ref),
                "promo_code": s.promo_code.code if s.promo_code_id else None,
                "trial_end": iso(s.trial_end),
                "current_period_end": iso(s.current_period_end),
                "cancel_at_period_end": s.cancel_at_period_end,
                "created_at": iso(s.created_at),
            }
            for s in subscriptions
        ],
        "invoices": [
            {
                "number": i.number,
                "amount_cents": i.amount_paid_cents,
                "paid_at": iso(i.paid_at),
                "fatura_reference": i.fatura_reference,
            }
            for i in PaidInvoice.objects.filter(org=org)[:20]
        ],
        # Status only: what was submitted (registry codes) stays out of the Nexus.
        "verifications": [
            {
                "type": v.type,
                "status": v.status,
                "submitted_at": iso(v.submitted_at),
                "reviewed_at": iso(v.reviewed_at),
                "valid_until": iso(v.valid_until),
            }
            for v in Verification.objects.filter(org=org).order_by("-submitted_at")[:20]
        ],
        "stats": {
            "followers": org.followers.count(),
            "profile_views_30d": ProfileView.objects.filter(org=org, viewed_at__gte=now - timedelta(days=30)).count(),
            "posts": Activity.objects.filter(org=org).count(),
            "posts_removed": Activity.all_objects.filter(org=org, removed_at__isnull=False).count(),
            "jobs_open": JobPost.objects.filter(org=org, status=JobPost.Status.OPEN).count(),
        },
        "history": audit.history("org", org.slug),
        "can_manage": nexus_role(viewer) == "admin",
    }


class OrgView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request, slug):
        return Response(_detail(get_object_or_404(Organization, slug=slug), request.user))


class OrgActionView(APIView):
    """POST /nexus/orgs/<slug>/<action>/ — admins only."""

    permission_classes = [IsNexusStaff]

    def post(self, request, slug, action):
        require(request.user, "orgs.manage")
        org = get_object_or_404(Organization, slug=slug)
        reason = required_reason(request)
        if action == "comp":
            grant = bool(request.data.get("value"))
            if grant:
                grant_comp(org)
            else:
                Subscription.objects.filter(
                    org=org, plan=Subscription.Plan.COMP, status=Subscription.Status.ACTIVE
                ).update(status=Subscription.Status.CANCELED)
            audit.record(
                request.user, NexusAction.Action.ORG_COMP, target_type="org", target_id=org.slug, label=org.name, reason=reason, value=grant
            )
        elif action == "extend":
            try:
                days = int(request.data.get("days") or 0)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"days": ["A whole number of days."]}) from exc
            if not 1 <= days <= 365:
                raise ValidationError({"days": ["Between 1 and 365 days."]})
            until = extend_free_period(org, days)
            audit.record(
                request.user,
                NexusAction.Action.ORG_FREE_EXTENDED,
                target_type="org",
                target_id=org.slug,
                label=org.name,
                reason=reason,
                days=days,
                until=until.isoformat(),
            )
        elif action == "verify":
            value = bool(request.data.get("value"))
            org.is_verified = value
            org.save(update_fields=["is_verified"])
            audit.record(
                request.user, NexusAction.Action.ORG_VERIFIED, target_type="org", target_id=org.slug, label=org.name, reason=reason, value=value
            )
        else:
            return Response(status=404)
        org.refresh_from_db()
        return Response(_detail(org, request.user))


def extend_free_period(org, days: int):
    """Add days to the free period running now; with none (it ended, or the
    organisation never had one), start a free period of that length. A
    Stripe-managed subscription is changed in Stripe, not here."""
    now = timezone.now()
    if Subscription.objects.filter(org=org).exclude(provider_ref="").filter(
        status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING, Subscription.Status.PAST_DUE]
    ).exists():
        raise ValidationError({"detail": "This organisation pays through Stripe — change it there."})
    running = (
        Subscription.objects.filter(org=org, provider_ref="", status=Subscription.Status.TRIALING, trial_end__gt=now)
        .order_by("-trial_end")
        .first()
    )
    if running:
        running.trial_end = running.trial_end + timedelta(days=days)
        running.save(update_fields=["trial_end", "updated_at"])
        return running.trial_end
    row = Subscription.objects.create(
        org=org,
        plan=Subscription.Plan.ORG_YEARLY,
        status=Subscription.Status.TRIALING,
        source=Subscription.Source.ADMIN,
        trial_end=now + timedelta(days=days),
    )
    return row.trial_end
