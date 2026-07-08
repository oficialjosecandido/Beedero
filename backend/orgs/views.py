import base64
import binascii
import logging
import re
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from accounts.models import InvestorPost, InvestorProfile
from analytics.models import InterestSignal, ProfileView
from beedero.ratelimit import enforce_rate_limit
from billing.entitlements import has_entitlement
from billing.services import maybe_refund_as_credit

from .completeness import CHECKLIST_HINTS, REFUND_REQUIREMENTS, _has, completeness, is_refund_eligible
from .constants import ACTIVITY_KINDS, FUNDRAISE_KINDS, SectionKind
from .discovery import discover
from .feed import occurred_at_of, org_feed_items
from .models import (
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
from .public import public_profile
from .serializers import (
    FeedPostSerializer,
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

IDENTITY_FIELD_COUNT_KINDS = [
    SectionKind.ABOUT,
    SectionKind.TEAM,
    SectionKind.PRODUCTS,
    SectionKind.MARKET_THESIS,
]


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


def org_profile_field_count(org):
    return OrgField.objects.filter(
        section__org=org,
        section__kind__in=IDENTITY_FIELD_COUNT_KINDS,
    ).count()


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
        """§2: creation is deliberately minimal — name + one_liner only, draft
        by default. Everything else (logo, sector, identity sections) is
        filled in progressively from the dashboard, never required upfront."""
        enforce_rate_limit(f"create_org:user:{request.user.id}", limit=5, window_seconds=3600)
        enforce_rate_limit(
            f"create_org:ip:{request.META.get('REMOTE_ADDR')}", limit=10, window_seconds=3600
        )
        name = request.data.get("name")
        one_liner = request.data.get("one_liner")
        if not name or not one_liner:
            return Response({"detail": "name and one_liner are required."}, status=400)
        org = Organization.objects.create(
            slug=unique_org_slug(name),
            name=name,
            one_liner=one_liner,
            # is_verified stays at its False default here — domain-match
            # verification is only trustworthy once the owner's email is
            # confirmed, which is enforced at publish time (OrgActivateView).
        )
        OrgMembership.objects.create(org=org, user=request.user, role=OrgMembership.Role.OWNER)
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


class OrgLogoView(OrgLookupMixin, APIView):
    """PUT /api/orgs/<slug>/logo/ — owner/admin uploads the org's logo."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def put(self, request, slug):
        org = self.get_org()
        logo = request.FILES.get("logo")
        if not logo:
            return Response({"detail": "logo file is required."}, status=400)
        org.logo = logo
        org.save(update_fields=["logo"])
        maybe_refund_as_credit(org)
        return Response(_org_summary(org))


class OrgOnboardingView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/onboarding/ — owner/admin-only status, profile
    strength meter, and checklist. `fee`/refund fields are legacy (the
    commitment fee is inactive per freemium doc §7) and will be null for any
    org activated after that change; kept so old paid orgs still report
    correctly."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        fee = getattr(org, "commitment_fee", None)
        checklist = [
            {"key": key, "done": _has(org, key), "hint": CHECKLIST_HINTS[key]}
            for key in REFUND_REQUIREMENTS
        ]
        return Response(
            {
                "status": org.status,
                "completeness": completeness(org),
                "refund_eligible": is_refund_eligible(org),
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
    """GET /api/orgs/<slug>/stats/ — Overview tab: followers + distinct visitors."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        return Response(
            {
                "followers_count": OrgFollow.objects.filter(org=org).count(),
                "visitors_count": OrgVisit.objects.filter(org=org).count(),
            }
        )


class OrgMembersView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/members/ — team list, visible to any member."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request, slug):
        org = self.get_org()
        members = OrgMembership.objects.filter(org=org).select_related("user").order_by("role", "id")
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
        role = request.data.get("role")
        if role not in OrgMembership.Role.values:
            return Response({"detail": "Invalid role."}, status=400)
        if role != OrgMembership.Role.OWNER:
            blocked = self._protect_last_owner(org, member)
            if blocked:
                return blocked
        member.role = role
        member.save(update_fields=["role"])
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
        invites = OrgInvite.objects.filter(org=org, revoked_at__isnull=True).order_by("-created_at")
        return Response(OrgInviteSerializer(invites, many=True).data)

    def post(self, request, slug):
        org = self.get_org()
        role = request.data.get("role", OrgMembership.Role.MEMBER)
        if role not in OrgMembership.Role.values:
            return Response({"detail": "Invalid role."}, status=400)
        invite = OrgInvite.objects.create(org=org, role=role, created_by=request.user)
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
        invite = get_object_or_404(OrgInvite, token=token)
        if not invite.is_active:
            return Response({"detail": "This invite link has been revoked."}, status=400)
        _, created = OrgMembership.objects.get_or_create(
            org=invite.org, user=request.user, defaults={"role": invite.role}
        )
        if created:
            invite.uses_count += 1
            invite.save(update_fields=["uses_count"])
        return Response({"slug": invite.org.slug, "name": invite.org.name})


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
    """§4: POST /api/orgs/<slug>/rounds/ — opens a round, creates restricted
    fundraise sections, and grants automatic access to the verified_investor role."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        round_ = getattr(org, "fundraiseround", None)
        if round_ and round_.is_open:
            return Response({"detail": "A round is already open."}, status=400)

        data = request.data
        if round_ is None:
            serializer = FundraiseRoundSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            round_ = serializer.save(org=org)
        else:
            for field in ("valuation", "ask_amount", "use_of_funds", "stage"):
                if field in data:
                    setattr(round_, field, data[field])
            round_.is_open = True
            round_.closed_at = None
            round_.save()

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
        round_.save()

        org.is_fundraising = False
        org.save(update_fields=["is_fundraising"])

        # Archived, not deleted (§1): they drop out of the resolver but history stays.
        OrgSection.objects.filter(org=org, kind__in=FUNDRAISE_KINDS).update(
            archived_at=timezone.now()
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedPostView(OrgLookupMixin, APIView):
    """§4: POST /api/orgs/<slug>/feed/ — publish news/milestone/event/award."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def post(self, request, slug):
        org = self.get_org()
        if org_profile_field_count(org) < 5:
            return Response(
                {"detail": "Add at least 5 organization profile fields before posting updates."},
                status=400,
            )
        if OrgField.objects.filter(
            section__org=org,
            section__kind__in=ACTIVITY_KINDS,
            key__startswith="post_",
            created_at__date=timezone.localdate(),
        ).exists():
            return Response(
                {"detail": "This profile has already shared a post today."},
                status=400,
            )
        serializer = FeedPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        field = serializer.create(org)
        return Response({"key": field.key, "value": field.value}, status=status.HTTP_201_CREATED)


_CURSOR_VERSION = "v1"


def _encode_feed_cursor(occurred_at, item_id):
    payload = f"{_CURSOR_VERSION}|{occurred_at.isoformat()}|{item_id}"
    return base64.urlsafe_b64encode(payload.encode()).decode()


def _decode_feed_cursor(raw):
    try:
        decoded = base64.urlsafe_b64decode(raw.encode()).decode()
        version, occurred_at_raw, item_id = decoded.split("|", 2)
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return None
    if version != _CURSOR_VERSION:
        return None
    occurred_at = parse_datetime(occurred_at_raw)
    if occurred_at is None:
        return None
    return occurred_at, item_id


class FeedView(APIView):
    """§4: keyset-paginated feed, ordered by (occurred_at, id) descending so
    that ties don't reorder between requests and pages don't skip/repeat
    items as new posts land — an offset-based `page=N` would."""

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
            cursor = _decode_feed_cursor(cursor_raw)
            if cursor is None:
                return Response({"detail": "Invalid cursor."}, status=400)

        followed_orgs = OrgFollow.objects.filter(user=request.user).values_list("org_id", flat=True)
        org_posts = org_feed_items(request.user, followed_orgs, limit=self.MAX_LIMIT * 4)
        items = [
            {
                "id": f"org:{post.id}",
                "type": "org",
                "org": _org_summary(post.section.org),
                "kind": post.section.kind,
                "key": post.key,
                "value": post.value,
                "occurred_at": occurred_at_of(post),
            }
            for post in org_posts
        ]

        followed_user_ids = UserFollow.objects.filter(follower=request.user).values_list(
            "followed_id", flat=True
        )
        person_posts = (
            InvestorPost.objects.filter(author_id__in=followed_user_ids)
            .select_related("author__investorprofile")
            .order_by("-occurred_at")[: self.MAX_LIMIT * 4]
        )
        items += [
            {
                "id": f"person:{post.id}",
                "type": "person",
                "author": {
                    "id": post.author_id,
                    "name": _investor_display_name(post.author),
                },
                "kind": post.kind,
                "key": f"investorpost_{post.id}",
                "value": {
                    "title": post.title,
                    "body": post.body,
                    "image": post.image.url if post.image else None,
                    "occurred_at": post.occurred_at.isoformat(),
                },
                "occurred_at": post.occurred_at,
            }
            for post in person_posts
        ]

        items.sort(key=lambda item: (item["occurred_at"], item["id"]), reverse=True)

        if cursor is not None:
            items = [item for item in items if (item["occurred_at"], item["id"]) < cursor]

        page = items[:limit]
        next_cursor = None
        if len(items) > limit:
            last = page[-1]
            next_cursor = _encode_feed_cursor(last["occurred_at"], last["id"])

        for item in page:
            item["occurred_at"] = item["occurred_at"].isoformat()

        return Response({"items": page, "next_cursor": next_cursor})


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
    """§4: GET /api/discovery/?stage=&sector=&geo=&check="""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = discover(request.user, request.query_params)
        return Response(
            [_org_summary(o) for o in qs]
        )
