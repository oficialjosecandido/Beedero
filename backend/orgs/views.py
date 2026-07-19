import logging
import re
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from accounts.models import InvestorProfile
from analytics.models import InterestSignal, ProfileView
from beedero.pagination import decode_cursor, encode_cursor
from beedero.ratelimit import enforce_rate_limit
from billing.entitlements import has_entitlement
from billing.services import maybe_refund_as_credit
from social.services import (
    reaction_counts_for,
    viewer_has_commented_for,
    viewer_participations_for,
    viewer_reactions_for,
)

from .completeness import (
    completeness,
    is_publish_ready,
    is_refund_eligible,
    profile_strength_checklist,
)
from .constants import FUNDRAISE_KINDS, SectionKind
from .discovery import discover, discover_active_this_week, discover_people
from .feed import activity_feed_items
from .models import (
    Activity,
    FundraiseRound,
    OrgField,
    OrgFollow,
    OrgInvite,
    OrgMembership,
    Organization,
    OrgSection,
    OrgVisit,
    RestrictedAccessLog,
    UserFollow,
    VisibilityGrant,
)
from .permissions import IsOrgMember, IsOrgOwnerOrAdmin, IsVerifiedInvestor, OrgLookupMixin
from .posting.constants import ACTIVITY_TO_POST_KIND
from .posting.services import (
    activity_post_summary,
    create_org_post,
    posting_status,
    update_org_post,
)
from .public import public_profile
from .serializers import (
    FundraiseRoundSerializer,
    OrgFieldWriteSerializer,
    OrgInviteSerializer,
    OrgMembershipSerializer,
    OrgPatchSerializer,
    OrgProfileSerializer,
    VisibilityGrantSerializer,
    _org_summary,
)
from .visibility import VisibilityResolver

logger = logging.getLogger(__name__)


FIELD_KEY_RE = re.compile(r"^[a-z0-9_]{1,50}$")

# P1.6: a repeat GET from the same viewer within this window doesn't create
# another ProfileView row — keeps OrgInsightView's counts meaningful instead
# of inflated by page refreshes/re-renders.
PROFILE_VIEW_DEDUPE_HOURS = 24


def unique_org_slug(name: str) -> str:
    base = slugify(name)[:45] or "organization"
    slug = base
    suffix = 2
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def _owner_email_verifies_org(email: str, name: str) -> bool:
    """Auto-verify when the creator's email domain is an exact match for the
    org name as a domain (name="Google" + owner@google.com verifies; a
    look-alike like owner@google.com.info must not, so multi-label domains
    are rejected rather than prefix-matched)."""
    if "@" not in email:
        return False
    domain = email.rsplit("@", 1)[1].lower()
    label, sep, rest = domain.partition(".")
    return sep == "." and "." not in rest and label == slugify(name)


def ensure_default_beedero_follow(user):
    if OrgFollow.objects.filter(user=user).exists():
        return
    org, _ = Organization.objects.get_or_create(
        slug="beedero",
        defaults={
            "name": "Beedero",
            "one_liner": "The onboarding layer for investor-ready organizations.",
            "status": Organization.Status.LIVE,
            "stage": "seed",
            "sector": "software",
            "geo": "remote",
            "is_verified": True,
        },
    )
    OrgFollow.objects.get_or_create(user=user, org=org)


def _investor_display_name(user):
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or user.email


def _investor_public_name(user):
    """Like `_investor_display_name`, but for passive-analytics contexts
    (profile views, interest signals, data-room opens) where the investor
    never chose to publish anything — falling back to their email would leak
    contact info they never agreed to hand the founder. Falls back to a
    generic label instead."""
    if user is None:
        return None
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or "Investor"


class PublicOrgProfileView(APIView):
    """§4: GET /api/public/orgs/<slug>/ — no auth, public fields only."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        return Response(public_profile(slug))


class OrgListCreateView(APIView):
    """Not in the §4 table, but indispensable: the founder needs to create
    their org before there's anything to visit."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = OrgMembership.objects.filter(user=request.user).select_related("org")
        return Response(
            [
                {"slug": m.org.slug, "name": m.org.name, "role": m.role, "logo": _org_summary(m.org)["logo"]}
                for m in memberships
            ]
        )

    def post(self, request):
        """§2: creation is deliberately minimal — name is the only hard
        requirement, draft by default. Everything else (one_liner, logo,
        sector, identity sections) is filled in progressively from the
        onboarding stepper/dashboard, never required upfront."""
        enforce_rate_limit(f"create_org:user:{request.user.id}", limit=5, window_seconds=3600)
        enforce_rate_limit(
            f"create_org:ip:{request.META.get('REMOTE_ADDR')}", limit=10, window_seconds=3600
        )
        name = request.data.get("name")
        one_liner = request.data.get("one_liner") or ""
        if not name:
            return Response({"detail": "name is required."}, status=400)

        # unique_org_slug()'s own existence check is check-then-create, so two
        # concurrent requests for the same name can both pass it before
        # either commits. Each attempt gets its own savepoint (nested
        # atomic(), since RLSViewerMiddleware already wraps the whole request
        # in a transaction) so a collision only unwinds that one INSERT
        # instead of poisoning the request's outer transaction.
        org = None
        for _attempt in range(5):
            try:
                with transaction.atomic():
                    org = Organization.objects.create(
                        slug=unique_org_slug(name),
                        name=name,
                        one_liner=one_liner,
                        # is_verified stays at its False default here — domain-match
                        # verification is only trustworthy once the owner's email is
                        # confirmed, which is enforced at publish time (OrgActivateView).
                    )
                break
            except IntegrityError:
                continue
        if org is None:
            return Response({"detail": "Could not create organization, please try again."}, status=409)

        OrgMembership.objects.create(org=org, user=request.user, role=OrgMembership.Role.OWNER)
        OrgFollow.objects.get_or_create(user=request.user, org=org)
        return Response({"slug": org.slug, "name": org.name}, status=status.HTTP_201_CREATED)


class OrgProfileView(OrgLookupMixin, APIView):
    """§4: GET /api/orgs/<slug>/ — full profile filtered by VisibilityResolver.
    PATCH — progressive owner/admin edits to the org's basic attributes."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [permissions.IsAuthenticated(), IsOrgOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get(self, request, slug):
        org = self.get_org()
        resolver = VisibilityResolver(viewer=request.user, org=org)
        if not resolver.is_member:
            OrgVisit.objects.get_or_create(org=org, user=request.user)
            # P1.6: dedupe repeat views within a day so a viewer refreshing
            # the page doesn't inflate `OrgInsightView`'s counts — a genuine
            # return visit on a later day still records a new row.
            recent_cutoff = timezone.now() - timedelta(hours=PROFILE_VIEW_DEDUPE_HOURS)
            already_viewed = ProfileView.objects.filter(
                org=org, viewer=request.user, viewed_at__gte=recent_cutoff
            ).exists()
            if not already_viewed:
                ProfileView.objects.create(
                    org=org,
                    viewer=request.user,
                    viewer_is_investor=hasattr(request.user, "investorprofile"),
                )
        data = OrgProfileSerializer(org, resolver, request=request).data()
        return Response(data)

    def patch(self, request, slug):
        org = self.get_org()
        serializer = OrgPatchSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(_org_summary(org))


MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024


class OrgLogoView(OrgLookupMixin, APIView):
    """PUT /api/orgs/<slug>/logo/ — owner/admin uploads the org's logo."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def put(self, request, slug):
        org = self.get_org()
        logo = request.FILES.get("logo")
        if not logo:
            return Response({"detail": "logo file is required."}, status=400)
        if logo.size > MAX_LOGO_SIZE_BYTES:
            return Response({"detail": "Logo must be 5MB or smaller."}, status=400)
        # ImageField.run_validation opens the file with Pillow, so this also
        # rejects any upload that isn't actually a decodable image regardless
        # of its filename/content-type — request.FILES alone doesn't check.
        # It defers to Django's own ImageField.clean() internally, which
        # raises django's ValidationError rather than DRF's.
        try:
            logo = serializers.ImageField().run_validation(logo)
        except (serializers.ValidationError, DjangoValidationError) as exc:
            detail = exc.detail if isinstance(exc, serializers.ValidationError) else exc.messages
            return Response({"detail": detail}, status=400)
        org.logo = logo
        org.save(update_fields=["logo"])
        maybe_refund_as_credit(org)
        return Response(_org_summary(org))


class OrgOnboardingView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/onboarding/ — profile strength meter and activation
    checklist for any org member. Publish remains owner/admin-only via
    OrgActivateView. `fee`/refund fields are legacy (the commitment fee is
    inactive per freemium doc §7) and will be null for any org activated after
    that change; kept so old paid orgs still report correctly."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        fee = getattr(org, "commitment_fee", None)
        checklist = profile_strength_checklist(org)
        return Response(
            {
                "status": org.status,
                "completeness": completeness(org),
                "refund_eligible": is_refund_eligible(org),
                "publish_ready": is_publish_ready(org),
                "checklist": checklist,
                "fee": (
                    {"amount_cents": fee.amount_cents, "status": fee.status, "refund_as_credit": True}
                    if fee
                    else None
                ),
            }
        )


class OrgInsightView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/insight/ — the founder-insight product (doc §5),
    built now and dormant: aggregate counts are always returned (the free
    teaser), the detail lists are gated by `has_entitlement` and are `null`
    until their feature is added to `billing.entitlements.PAID_FEATURES_LIVE`."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()

        viewers_entitled = has_entitlement(org, "profile_viewers")
        views_qs = (
            ProfileView.objects.filter(org=org)
            .select_related("viewer__investorprofile")
            .order_by("-viewed_at")
        )
        week_ago = timezone.now() - timedelta(days=7)
        week_views = views_qs.filter(viewed_at__gte=week_ago).count()
        if week_views:
            from notifications.services import notify_profile_views

            notify_profile_views(org, week_views)

        signals_entitled = has_entitlement(org, "interest_signals")
        signals_qs = (
            InterestSignal.objects.filter(org=org)
            .select_related("investor__investorprofile")
            .order_by("-created_at")
        )

        deck_entitled = has_entitlement(org, "deck_analytics")
        opens_qs = (
            RestrictedAccessLog.objects.filter(org=org, section_kind=SectionKind.DATA_ROOM)
            .select_related("viewer__investorprofile")
            .order_by("-accessed_at")
        )

        return Response(
            {
                "profile_views_count": views_qs.count(),
                "viewers": (
                    [
                        {"investor": _investor_public_name(v.viewer), "viewed_at": v.viewed_at}
                        for v in views_qs[:200]
                    ]
                    if viewers_entitled
                    else None
                ),
                "interest_signals_count": signals_qs.count(),
                "interest_signals": (
                    [
                        {
                            "investor": _investor_public_name(s.investor),
                            "kind": s.kind,
                            "created_at": s.created_at,
                        }
                        for s in signals_qs[:200]
                    ]
                    if signals_entitled
                    else None
                ),
                "dataroom_opens_count": opens_qs.count(),
                "dataroom_opens": (
                    [
                        {
                            "investor": _investor_public_name(o.viewer),
                            "field_key": o.field_key,
                            "accessed_at": o.accessed_at,
                        }
                        for o in opens_qs[:200]
                    ]
                    if deck_entitled
                    else None
                ),
            }
        )


class OrgActivateView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/activate/ — publish the org (draft -> live).

    Freemium doc §7: publishing is free. The old anti-spam gate was a
    commitment fee (`billing.services.confirm_payment`, still intact for a
    possible future paid "featured" tier but no longer called here); the
    replacement gate is a non-monetary one — the requesting owner/admin's
    email must be verified.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        if org.status == Organization.Status.LIVE:
            return Response({"detail": "Organization is already live."}, status=400)
        if not request.user.is_email_verified:
            return Response(
                {"detail": "Verify your email before publishing.", "action": "verify_email"},
                status=403,
            )
        if not is_publish_ready(org):
            return Response(
                {"detail": "Complete all required profile fields before publishing."},
                status=400,
            )
        # Domain-match verification only counts once the owner's email is
        # confirmed (guaranteed above) — never at creation time.
        update_fields = ["status"]
        if not org.is_verified and _owner_email_verifies_org(request.user.email, org.name):
            org.is_verified = True
            update_fields.append("is_verified")
        org.status = Organization.Status.LIVE
        org.save(update_fields=update_fields)
        return Response({"slug": org.slug, "status": org.status})


class OrgStatsView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/stats/?range=7d|30d — Overview tab: followers +
    distinct visitors, plus delta cards (doc §3) backed by the nightly
    `DailyOrgStats` snapshot. No sparklines, no auto-insight — just two
    summed totals for the selected window."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        from django.db.models import Sum

        from analytics.models import DailyOrgStats

        org = self.get_org()
        days = 30 if request.query_params.get("range") == "30d" else 7
        since = timezone.localdate() - timedelta(days=days)
        window = DailyOrgStats.objects.filter(org=org, date__gte=since).aggregate(
            new_followers=Sum("new_followers_count"), profile_views=Sum("profile_views_count")
        )
        return Response(
            {
                "followers_count": OrgFollow.objects.filter(org=org).count(),
                "visitors_count": OrgVisit.objects.filter(org=org).count(),
                "range_days": days,
                "new_followers": window["new_followers"] or 0,
                "profile_views": window["profile_views"] or 0,
            }
        )


class OrgMembersView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/members/ — team list, visible to any member."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        members = (
            OrgMembership.objects.filter(org=org)
            .select_related("user", "user__investorprofile")
            .order_by("role", "id")
        )
        return Response(OrgMembershipSerializer(members, many=True).data)


class OrgMemberDetailView(OrgLookupMixin, APIView):
    """PATCH (role change) / DELETE (remove) — owner/admin only. Guards the last owner."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def _protect_last_owner(self, org, member):
        if member.role != OrgMembership.Role.OWNER:
            return None
        remaining_owners = OrgMembership.objects.filter(
            org=org, role=OrgMembership.Role.OWNER
        ).exclude(id=member.id)
        if not remaining_owners.exists():
            return Response({"detail": "An organization needs at least one owner."}, status=400)
        return None

    def patch(self, request, slug, member_id):
        org = self.get_org()
        member = get_object_or_404(OrgMembership, org=org, id=member_id)
        updated_fields = []

        if "title" in request.data:
            title = str(request.data.get("title") or "").strip()[:120]
            member.title = title
            updated_fields.append("title")

        role = request.data.get("role")
        if role is not None:
            if role not in OrgMembership.Role.values:
                return Response({"detail": "Invalid role."}, status=400)
            if role != OrgMembership.Role.OWNER:
                blocked = self._protect_last_owner(org, member)
                if blocked:
                    return blocked
            member.role = role
            updated_fields.append("role")

        if not updated_fields:
            return Response({"detail": "Nothing to update."}, status=400)

        member.save(update_fields=updated_fields)
        return Response(OrgMembershipSerializer(member).data)

    def delete(self, request, slug, member_id):
        org = self.get_org()
        member = get_object_or_404(OrgMembership, org=org, id=member_id)
        blocked = self._protect_last_owner(org, member)
        if blocked:
            return blocked
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrgInviteListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/invites/ — shareable invite links, owner/admin only."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        invites = (
            OrgInvite.objects.filter(org=org, revoked_at__isnull=True)
            .filter(Q(max_uses__isnull=True) | Q(uses_count__lt=F("max_uses")))
            .order_by("-created_at")
        )
        return Response(OrgInviteSerializer(invites, many=True).data)

    def post(self, request, slug):
        org = self.get_org()
        role = request.data.get("role", OrgMembership.Role.MEMBER)
        if role not in OrgMembership.Role.values:
            return Response({"detail": "Invalid role."}, status=400)

        expires_at = None
        raw_expires_at = request.data.get("expires_at")
        if raw_expires_at:
            expires_at = parse_datetime(raw_expires_at)
            if expires_at is None:
                return Response({"detail": "expires_at must be an ISO 8601 datetime."}, status=400)

        max_uses = request.data.get("max_uses", 1)
        if max_uses is not None:
            try:
                max_uses = int(max_uses)
            except (TypeError, ValueError):
                return Response({"detail": "max_uses must be an integer."}, status=400)
            if max_uses < 1:
                return Response({"detail": "max_uses must be at least 1."}, status=400)

        invite = OrgInvite.objects.create(
            org=org, role=role, created_by=request.user, expires_at=expires_at, max_uses=max_uses
        )
        return Response(OrgInviteSerializer(invite).data, status=status.HTTP_201_CREATED)


class OrgInviteDetailView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def delete(self, request, slug, invite_id):
        org = self.get_org()
        invite = get_object_or_404(OrgInvite, org=org, id=invite_id)
        invite.revoked_at = timezone.now()
        invite.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrgInviteAcceptView(APIView):
    """POST /api/invites/<token>/accept/ — any logged-in user joins via a shared link."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        # select_for_update: two simultaneous accepts on the last remaining
        # use of a capped invite must not both slip through the check below.
        with transaction.atomic():
            invite = get_object_or_404(OrgInvite.objects.select_for_update(), token=token)
            org_slug = invite.org.slug
            org_name = invite.org.name
            already_member = OrgMembership.objects.filter(org=invite.org, user=request.user).exists()
            if already_member:
                return Response({"slug": org_slug, "name": org_name})
            if invite.revoked_at is not None:
                return Response({"detail": "This invite link has been revoked."}, status=400)
            if invite.expires_at is not None and invite.expires_at <= timezone.now():
                return Response({"detail": "This invite link has expired."}, status=400)
            if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
                return Response({"detail": "This invite link has reached its usage limit."}, status=400)
            OrgMembership.objects.create(org=invite.org, user=request.user, role=invite.role)
            OrgFollow.objects.get_or_create(user=request.user, org=invite.org)
            invite.uses_count += 1
            if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
                invite.revoked_at = timezone.now()
                invite.save(update_fields=["uses_count", "revoked_at"])
            else:
                invite.save(update_fields=["uses_count"])
        return Response({"slug": org_slug, "name": org_name})


class SectionListView(OrgLookupMixin, APIView):
    """Not in the §4 table, but the dashboard needs section IDs (not just
    the kind) to be able to target grants at a specific section."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        sections = OrgSection.objects.filter(org=org, archived_at__isnull=True).order_by("position")
        return Response(
            [
                {
                    "id": s.id,
                    "kind": s.kind,
                    "visibility": s.visibility,
                    "fields": [
                        {
                            "id": f.id,
                            "key": f.key,
                            "value": f.value,
                            "visibility": f.visibility,
                            "created_at": f.created_at,
                        }
                        for f in s.fields.all()
                    ],
                }
                for s in sections
            ]
        )


class SectionFieldView(OrgLookupMixin, APIView):
    """Not in the §4 table, but the dashboard needs this so the founder
    can fill in About/Team/Financials/Data Room. Visibility not explicitly
    passed inherits the section's (same rule as OrgField.save())."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def put(self, request, slug, kind, key):
        if not FIELD_KEY_RE.match(key):
            return Response({"detail": "Invalid field key."}, status=400)
        serializer = OrgFieldWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        org = self.get_org()
        section = get_object_or_404(OrgSection, org=org, kind=kind, archived_at__isnull=True)
        field, created = OrgField.objects.get_or_create(
            section=section, key=key, defaults={"value": serializer.validated_data["value"]}
        )
        if not created:
            field.value = serializer.validated_data["value"]
        visibility = serializer.validated_data.get("visibility")
        if visibility:
            field.visibility = visibility
        field.save()
        maybe_refund_as_credit(org)
        return Response({"key": field.key, "value": field.value, "visibility": field.visibility})

    def delete(self, request, slug, kind, key):
        org = self.get_org()
        section = get_object_or_404(OrgSection, org=org, kind=kind)
        OrgField.objects.filter(section=section, key=key).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DataRoomView(OrgLookupMixin, APIView):
    """§4: GET /api/orgs/<slug>/dataroom/ — writes an audit log entry per opened document."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember | IsVerifiedInvestor]

    def get(self, request, slug):
        org = self.get_org()
        resolver = VisibilityResolver(viewer=request.user, org=org)
        fields = list(
            resolver.visible_fields()
            .filter(section__kind=SectionKind.DATA_ROOM)
            .select_related("section")
        )
        if not resolver.is_member:
            logs = [
                RestrictedAccessLog(
                    viewer=request.user,
                    org=org,
                    field_key=f.key,
                    section_kind=f.section.kind,
                    ip=request.META.get("REMOTE_ADDR"),
                )
                for f in fields
            ]
            # Savepoint, not the request's outer transaction: an audit-write
            # failure shouldn't take down a data-room read that already
            # succeeded, or abort the transaction for the rest of the request.
            try:
                with transaction.atomic():
                    RestrictedAccessLog.objects.bulk_create(logs)
            except Exception:
                logger.exception("Failed to write data-room audit log for org=%s", org.id)
        return Response({"documents": {f.key: f.value for f in fields}})


class GrantListCreateView(OrgLookupMixin, APIView):
    """§4: POST /api/orgs/<slug>/grants/ — grant/revoke access, owner only."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        grants = VisibilityGrant.objects.filter(org=org)
        return Response(VisibilityGrantSerializer(grants, many=True).data)

    def post(self, request, slug):
        org = self.get_org()
        serializer = VisibilityGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(org=org, granted_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GrantDetailView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def delete(self, request, slug, grant_id):
        org = self.get_org()
        VisibilityGrant.objects.filter(org=org, id=grant_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoundOpenView(OrgLookupMixin, APIView):
    """§4: GET/POST /api/orgs/<slug>/rounds/ — history of rounds, and opening a
    new one (creates restricted fundraise sections, grants access to
    verified_investor role)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated(), IsOrgOwnerOrAdmin()]
        return [permissions.IsAuthenticated(), IsOrgMember()]

    def get(self, request, slug):
        org = self.get_org()
        rounds = FundraiseRound.objects.filter(org=org)
        return Response(FundraiseRoundSerializer(rounds, many=True).data)

    def post(self, request, slug):
        org = self.get_org()
        if FundraiseRound.objects.filter(org=org, is_open=True).exists():
            return Response({"detail": "A round is already open."}, status=400)

        serializer = FundraiseRoundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        round_ = serializer.save(org=org)

        org.is_fundraising = True
        org.save(update_fields=["is_fundraising"])

        for kind in FUNDRAISE_KINDS:
            section, _ = OrgSection.objects.get_or_create(org=org, kind=kind)
            if section.archived_at is not None:
                section.archived_at = None
                section.save(update_fields=["archived_at"])
            VisibilityGrant.objects.get_or_create(
                org=org,
                section=section,
                principal_type=VisibilityGrant.Principal.ROLE,
                principal_id="verified_investor",
            )

        return Response(FundraiseRoundSerializer(round_).data, status=status.HTTP_201_CREATED)


class RoundCloseView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        round_ = get_object_or_404(FundraiseRound, org=org, is_open=True)
        round_.is_open = False
        round_.closed_at = timezone.now()
        raised_amount = request.data.get("raised_amount")
        if raised_amount not in (None, ""):
            round_.raised_amount = raised_amount
        round_.save()

        org.is_fundraising = False
        org.save(update_fields=["is_fundraising"])

        # Archived, not deleted (§1): they drop out of the resolver but history stays.
        OrgSection.objects.filter(org=org, kind__in=FUNDRAISE_KINDS).update(
            archived_at=timezone.now()
        )

        from notifications.milestones import check_round_closed_milestone

        check_round_closed_milestone(org, round_)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedPostView(OrgLookupMixin, APIView):
    """§4: GET/POST /api/orgs/<slug>/feed/ — list and publish org updates."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        activities = Activity.objects.filter(org=org).order_by("-created_at", "-id")
        return Response({"items": [_activity_summary(a) for a in activities]})

    def post(self, request, slug):
        org = self.get_org()
        kind = request.data.get("kind")
        legacy_map = {
            SectionKind.NEWS: "update",
            SectionKind.MILESTONES: "milestone",
            SectionKind.EVENTS: "event",
        }
        if kind in legacy_map:
            kind = legacy_map[kind]

        data = dict(request.data)
        if kind == "event":
            if "occurred_at" in data and "starts_at" not in data:
                data["starts_at"] = data["occurred_at"]
        if kind == "milestone" and "category" not in data:
            data["category"] = "other"

        activity = create_org_post(org, kind, data)

        from notifications.milestones import check_first_post_milestone

        check_first_post_milestone(org)
        return Response(_activity_summary(activity), status=status.HTTP_201_CREATED)


class OrgPostingStatusView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        return Response(posting_status(self.get_org()))


class OrgPostsView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def post(self, request, slug):
        org = self.get_org()
        kind = request.data.get("kind")
        data = dict(request.data)
        activity = create_org_post(org, kind, data)

        from notifications.milestones import check_first_post_milestone

        check_first_post_milestone(org)
        return Response(activity_post_summary(activity), status=status.HTTP_201_CREATED)


class OrgPostDetailView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def patch(self, request, slug, activity_id):
        org = self.get_org()
        activity = get_object_or_404(Activity, id=activity_id, org=org)
        post_kind = ACTIVITY_TO_POST_KIND.get(activity.kind)
        if post_kind is None:
            return Response({"detail": "This activity is not an org post."}, status=400)
        kind = request.data.get("kind", post_kind)
        activity = update_org_post(activity, kind, dict(request.data))
        return Response(activity_post_summary(activity))

    def delete(self, request, slug, activity_id):
        org = self.get_org()
        activity = get_object_or_404(Activity, id=activity_id, org=org)
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrgActivityDetailView(OrgLookupMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def delete(self, request, slug, activity_id):
        org = self.get_org()
        activity = get_object_or_404(Activity, id=activity_id, org=org)
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _activity_summary(
    activity,
    viewer_reaction=None,
    reaction_counts=None,
    viewer_has_commented=False,
    viewer_participation=None,
):
    kind = activity.kind
    if activity.org_id:
        kind = ACTIVITY_TO_POST_KIND.get(activity.kind, activity.kind)
    value = {
        "title": activity.title,
        "body": activity.body,
        "image": activity.image.url if activity.image else None,
        "occurred_at": activity.occurred_at.isoformat(),
        "ends_at": activity.ends_at.isoformat() if activity.ends_at else None,
    }
    if activity.payload:
        value["payload"] = activity.payload
    summary = {
        "id": activity.id,
        "type": "org" if activity.org_id else "person",
        "org": _org_summary(activity.org) if activity.org_id else None,
        "author": (
            None
            if activity.org_id
            else {"id": activity.author_id, "name": _investor_display_name(activity.author)}
        ),
        "kind": kind,
        "value": value,
        "reaction_count": activity.reaction_count,
        "reaction_counts": reaction_counts or {"like": 0, "insight": 0, "congrats": 0},
        "comment_count": activity.comment_count,
        "viewer_reaction": viewer_reaction,
        "viewer_has_commented": viewer_has_commented,
        "created_at": activity.created_at.isoformat(),
    }
    if activity.kind == Activity.Kind.EVENTS:
        summary["viewer_participation"] = viewer_participation
    return summary


def calendar_event_summary(activity):
    if activity.org_id:
        host = {"type": "org", "slug": activity.org.slug, "name": activity.org.name}
    else:
        host = {"type": "person", "id": activity.author_id, "name": _investor_display_name(activity.author)}
    return {
        "id": activity.id,
        "title": activity.title,
        "body": activity.body,
        "occurred_at": activity.occurred_at.isoformat(),
        "ends_at": activity.ends_at.isoformat() if activity.ends_at else None,
        "host": host,
    }


class FeedView(APIView):
    """§4: keyset-paginated feed, ordered by (created_at, id) descending."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 20
    MAX_LIMIT = 50

    def get(self, request):
        ensure_default_beedero_follow(request.user)

        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit."}, status=400)
        limit = max(1, min(limit, self.MAX_LIMIT))

        cursor = None
        cursor_raw = request.query_params.get("cursor")
        if cursor_raw:
            cursor = decode_cursor(cursor_raw)
            if cursor is None:
                return Response({"detail": "Invalid cursor."}, status=400)

        followed_org_ids = OrgFollow.objects.filter(user=request.user).values_list("org_id", flat=True)
        followed_user_ids = UserFollow.objects.filter(follower=request.user).values_list(
            "followed_id", flat=True
        )

        activities = list(
            activity_feed_items(
                request.user, followed_org_ids, followed_user_ids, limit=limit + 1, cursor=cursor
            )
        )

        next_cursor = None
        if len(activities) > limit:
            last = activities[limit - 1]
            next_cursor = encode_cursor(last.created_at, last.id)
            activities = activities[:limit]

        viewer_reactions = viewer_reactions_for(request.user, [a.id for a in activities])
        reaction_counts = reaction_counts_for([a.id for a in activities])
        commented_activity_ids = viewer_has_commented_for(request.user, [a.id for a in activities])
        viewer_participations = viewer_participations_for(request.user, [a.id for a in activities])

        return Response(
            {
                "items": [
                    _activity_summary(
                        a,
                        viewer_reactions.get(a.id),
                        reaction_counts.get(a.id),
                        a.id in commented_activity_ids,
                        viewer_participations.get(a.id),
                    )
                    for a in activities
                ],
                "next_cursor": next_cursor,
            }
        )


class RecommendationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        followed_org_ids = OrgFollow.objects.filter(user=request.user).values_list("org_id", flat=True)
        orgs = (
            Organization.objects.filter(status=Organization.Status.LIVE)
            .exclude(id__in=followed_org_ids)
            .order_by("-is_verified", "name")[:6]
        )

        followed_user_ids = UserFollow.objects.filter(follower=request.user).values_list(
            "followed_id", flat=True
        )
        people = (
            InvestorProfile.objects.exclude(full_name="")
            .exclude(user_id=request.user.id)
            .exclude(user_id__in=followed_user_ids)
            .select_related("user")
            .order_by("-is_verified", "full_name")[:6]
        )
        return Response(
            {
                "organizations": [_org_summary(org) for org in orgs],
                "people": [
                    {
                        "id": p.user_id,
                        "name": p.full_name,
                        "headline": p.headline,
                        "profile_picture": p.profile_picture.url if p.profile_picture else None,
                    }
                    for p in people
                ],
            }
        )


class FollowOrgView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        org = get_object_or_404(Organization, slug=slug)
        if org.status != Organization.Status.LIVE:
            return Response({"detail": "This organization is still a draft."}, status=400)
        _, created = OrgFollow.objects.get_or_create(user=request.user, org=org)
        if created and hasattr(request.user, "investorprofile"):
            InterestSignal.objects.create(org=org, investor=request.user, kind=InterestSignal.Kind.FOLLOWED)
        if created:
            from notifications.milestones import check_follower_milestone
            from notifications.services import notify_org_followed

            notify_org_followed(org, request.user)
            check_follower_milestone(org)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FollowUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        if user_id == request.user.id:
            return Response({"detail": "You cannot follow yourself."}, status=400)
        target = get_object_or_404(get_user_model(), id=user_id)
        UserFollow.objects.get_or_create(follower=request.user, followed=target)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DiscoveryView(APIView):
    """§4: GET /api/discovery/?stage=&sector=&geo=&check=

    P1.8: offset-paginated — the unbounded list used to return the entire
    LIVE org table in one response."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 20
    MAX_LIMIT = 50

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit."}, status=400)
        limit = max(1, min(limit, self.MAX_LIMIT))

        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid offset."}, status=400)

        qs = discover(request.user, request.query_params)
        page = list(qs[offset : offset + limit + 1])
        has_more = len(page) > limit
        page = page[:limit]

        return Response(
            {
                "items": [_org_summary(o) for o in page],
                "next_offset": offset + limit if has_more else None,
                "active_this_week": [_org_summary(o) for o in discover_active_this_week(request.user)],
            }
        )


class DiscoverPeopleView(APIView):
    """GET /api/discovery/people/?q= — search investors by name or headline."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 20
    MAX_LIMIT = 50

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit."}, status=400)
        limit = max(1, min(limit, self.MAX_LIMIT))

        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid offset."}, status=400)

        qs = discover_people(request.user, request.query_params)
        page = list(qs[offset : offset + limit + 1])
        has_more = len(page) > limit
        page = page[:limit]

        return Response(
            {
                "items": [
                    {
                        "id": profile.user_id,
                        "name": profile.full_name,
                        "headline": profile.headline,
                        "handle": profile.handle,
                        "is_verified": profile.is_verified,
                        "profile_picture": profile.profile_picture.url if profile.profile_picture else None,
                    }
                    for profile in page
                ],
                "next_offset": offset + limit if has_more else None,
            }
        )
