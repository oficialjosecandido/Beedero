from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from accounts.models import InvestorPost, InvestorProfile

from .constants import ACTIVITY_KINDS, FUNDRAISE_KINDS, SectionKind
from .discovery import discover
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
    OrgInviteSerializer,
    OrgMembershipSerializer,
    OrgProfileSerializer,
    VisibilityGrantSerializer,
    _org_summary,
)
from .visibility import VisibilityResolver


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


def ensure_default_beedero_follow(user):
    if OrgFollow.objects.filter(user=user).exists():
        return
    org, _ = Organization.objects.get_or_create(
        slug="beedero",
        defaults={
            "name": "Beedero",
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
        name = request.data.get("name")
        if not name:
            return Response({"detail": "name is required."}, status=400)
        org = Organization.objects.create(
            slug=unique_org_slug(name),
            name=name,
            stage=request.data.get("stage", ""),
            sector=request.data.get("sector", ""),
            geo=request.data.get("geo", ""),
        )
        OrgMembership.objects.create(org=org, user=request.user, role=OrgMembership.Role.OWNER)

        initial_fields = {
            SectionKind.ABOUT: {"summary": request.data.get("about")},
            SectionKind.TEAM: {"summary": request.data.get("team")},
            SectionKind.PRODUCTS: {"summary": request.data.get("products")},
            SectionKind.MARKET_THESIS: {"summary": request.data.get("market_thesis")},
        }
        for kind, fields in initial_fields.items():
            section = OrgSection.objects.get(org=org, kind=kind)
            for key, value in fields.items():
                if value:
                    OrgField.objects.update_or_create(
                        section=section,
                        key=key,
                        defaults={"value": value},
                    )

        return Response({"slug": org.slug, "name": org.name}, status=status.HTTP_201_CREATED)


class OrgProfileView(OrgLookupMixin, APIView):
    """§4: GET /api/orgs/<slug>/ — full profile filtered by VisibilityResolver."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        org = self.get_org()
        resolver = VisibilityResolver(viewer=request.user, org=org)
        if not resolver.is_member:
            OrgVisit.objects.get_or_create(org=org, user=request.user)
        data = OrgProfileSerializer(org, resolver, request=request).data()
        return Response(data)


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
        return Response(_org_summary(org))


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
        org = self.get_org()
        section = get_object_or_404(OrgSection, org=org, kind=kind, archived_at__isnull=True)
        field, created = OrgField.objects.get_or_create(
            section=section, key=key, defaults={"value": request.data.get("value")}
        )
        if not created:
            field.value = request.data.get("value")
        visibility = request.data.get("visibility")
        if visibility:
            field.visibility = visibility
        field.save()
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
            RestrictedAccessLog.objects.bulk_create(
                [
                    RestrictedAccessLog(
                        viewer=request.user,
                        org=org,
                        field_key=f.key,
                        section_kind=f.section.kind,
                        ip=request.META.get("REMOTE_ADDR"),
                    )
                    for f in fields
                ]
            )
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


class FeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ensure_default_beedero_follow(request.user)
        followed_orgs = OrgFollow.objects.filter(user=request.user).values_list("org_id", flat=True)
        org_posts = (
            OrgField.objects.filter(section__org_id__in=followed_orgs, section__kind__in=ACTIVITY_KINDS)
            .select_related("section__org")
            .order_by("-created_at")[:50]
        )
        items = [
            {
                "type": "org",
                "org": _org_summary(post.section.org),
                "kind": post.section.kind,
                "key": post.key,
                "value": post.value,
                "occurred_at": post.value.get("occurred_at") or post.created_at.isoformat(),
            }
            for post in org_posts
        ]

        followed_user_ids = UserFollow.objects.filter(follower=request.user).values_list(
            "followed_id", flat=True
        )
        person_posts = (
            InvestorPost.objects.filter(author_id__in=followed_user_ids)
            .select_related("author__investorprofile")
            .order_by("-occurred_at")[:50]
        )
        items += [
            {
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
                "occurred_at": post.occurred_at.isoformat(),
            }
            for post in person_posts
        ]

        items.sort(key=lambda item: item["occurred_at"], reverse=True)
        return Response(items[:50])


class RecommendationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        followed_org_ids = OrgFollow.objects.filter(user=request.user).values_list("org_id", flat=True)
        orgs = Organization.objects.exclude(id__in=followed_org_ids).order_by("-is_verified", "name")[:6]

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
                "organizations": [
                    {
                        **_org_summary(org),
                        "stage": org.stage,
                        "sector": org.sector,
                        "geo": org.geo,
                    }
                    for org in orgs
                ],
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
        OrgFollow.objects.get_or_create(user=request.user, org=org)
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
            [
                {
                    **_org_summary(o),
                    "stage": o.stage,
                    "sector": o.sector,
                    "geo": o.geo,
                }
                for o in qs
            ]
        )
