"""Creating an organisation: one page, checkout at the end.

This is the only way an organisation is born. `POST /api/org-onboarding/`
receives the whole page at once — the basics, the plan, an optional code, the
acceptance of the subscription terms and, when it comes from a co-founder
match, that match — and answers where the browser goes next:

  - with a valid code: the organisation exists with its free year, and the
    browser goes straight to the workspace (no card, no Stripe page);
  - without one: the organisation exists without a plan, and the browser goes
    to Stripe Checkout. If the person never finishes, the workspace shows the
    "choose a plan" screen until they do.

The path sits outside `orgs/` on purpose: `orgs/<slug>/` would answer to an
organisation called "onboard".
"""

import logging

from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.ratelimit import enforce_rate_limit

from .models import Organization, OrgFollow, OrgMembership

logger = logging.getLogger(__name__)


def unique_org_slug(name: str) -> str:
    from beedero.handles import compact_handle_base, unique_public_id

    base = compact_handle_base(name) or "organization"
    return unique_public_id(base, fallback="organization")


def create_organization(user, *, name: str, one_liner: str = "", **fields) -> Organization | None:
    """The organisation, its owner and the owner's follow. Draft, unverified.

    unique_org_slug()'s own existence check is check-then-create, so two
    concurrent requests for the same name can both pass it before either
    commits. Each attempt gets its own savepoint (nested atomic(), since
    RLSViewerMiddleware already wraps the whole request in a transaction) so
    a collision only unwinds that one INSERT instead of poisoning the
    request's outer transaction.
    """
    org = None
    for _attempt in range(5):
        try:
            with transaction.atomic():
                # is_verified stays False here — domain-match verification is
                # only trustworthy once the owner's email is confirmed, which
                # is enforced at publish time (OrgActivateView).
                org = Organization.objects.create(
                    slug=unique_org_slug(name), name=name, one_liner=one_liner, **fields
                )
            break
        except IntegrityError:
            continue
    if org is None:
        return None
    # Founder's own row: the one case where the member and the confirmer are
    # the same person, and it counts — an owner is the organisation's voice
    # (accounts/ladder.py rung 6, accounts/timeline.py badge).
    OrgMembership.objects.create(
        org=org,
        user=user,
        role=OrgMembership.Role.OWNER,
        details_confirmed_by=user,
        details_confirmed_at=timezone.now(),
    )
    OrgFollow.objects.get_or_create(user=user, org=org)
    return org


def enforce_creation_limits(request) -> None:
    enforce_rate_limit(f"create_org:user:{request.user.id}", limit=5, window_seconds=3600)
    enforce_rate_limit(f"create_org:ip:{request.META.get('REMOTE_ADDR')}", limit=10, window_seconds=3600)


class OrgOnboardingSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, trim_whitespace=True)
    one_liner = serializers.CharField(max_length=140, required=False, allow_blank=True, default="")
    stage = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    sector = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    geo = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    plan = serializers.ChoiceField(choices=["yearly", "monthly"], default="yearly")
    code = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    accept_terms = serializers.BooleanField()
    # A co-founder match this organisation comes from: the other person is
    # invited as an owner once it exists (cofounder/services.py).
    match = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("Accept the subscription terms to continue.")
        return value


class OrgOnboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from billing import subscriptions
        from billing.gateway import BillingUnavailable
        from billing.models import BillingAgreement
        from billing.plans import PLANS, TERMS_VERSION

        enforce_creation_limits(request)
        serializer = OrgOnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        code = data["code"].strip()
        if code:
            _, problem = subscriptions.find_code(code)
            if problem:  # before anything is created
                return Response({"code": [problem]}, status=status.HTTP_400_BAD_REQUEST)

        # Also before anything is created: a match that can't form a company
        # (already used, or the other person blocked) never reaches checkout.
        match = None
        if data["match"] is not None:
            from cofounder.services import match_for_new_org

            match = match_for_new_org(request.user, data["match"])

        # All or nothing: a code that fails at the last moment (used up by
        # someone else in between) leaves no organisation behind.
        with transaction.atomic():
            org = create_organization(
                request.user,
                name=data["name"],
                one_liner=data["one_liner"],
                stage=data["stage"],
                sector=data["sector"],
                geo=data["geo"],
            )
            if org is None:
                return Response({"detail": "Could not create organization, please try again."}, status=409)
            BillingAgreement.objects.create(
                org=org, user=request.user, terms_version=TERMS_VERSION, plan=PLANS[data["plan"]]["plan"]
            )
            if match is not None:
                from cofounder.services import attach_org_to_match

                attach_org_to_match(match, request.user, org)
            if code:
                subscriptions.redeem_free_period(org, data["plan"], code)

        if code:
            return Response(
                {"slug": org.slug, "next": "workspace", "url": f"/dashboard/{org.slug}?welcome=1"}, status=201
            )
        try:
            url = subscriptions.start_checkout(org, request.user, data["plan"])
        except (BillingUnavailable, ImproperlyConfigured):
            # The organisation exists; its workspace asks for a plan until
            # payments are back.
            logger.exception("Checkout unavailable during onboarding")
            return Response({"slug": org.slug, "next": "workspace", "url": f"/dashboard/{org.slug}"}, status=201)
        return Response({"slug": org.slug, "next": "checkout", "url": url}, status=201)
