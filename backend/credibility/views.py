import os
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.ratelimit import enforce_rate_limit
from orgs.models import OrgMembership, RestrictedAccessLog
from orgs.permissions import IsOrgOwnerOrAdmin, OrgLookupMixin

from .badge import badge_embed_html
from .levels import credibility_level
from .models import Verification, VerificationType
from .services import submit_verification
from .storage import private_doc_url
from .vitality import vitality_state

SUBMIT_RATE_LIMIT_PER_DAY = 5
STRIPE_STUB_VALIDITY = timedelta(days=14)


class CredibilityView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/credibility/ — level + per-type status. Members
    (owner/admin/team) see full review state including rejection reasons;
    everyone else authenticated only sees the public badge (verified or not)
    for types that have actually cleared review — no pending/rejected detail
    leaks to outsiders."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        org = self.get_org()
        is_member = OrgMembership.objects.filter(org=org, user=request.user).exists()

        verifications = {}
        seen_types = set()
        for v in Verification.objects.filter(org=org).order_by("-submitted_at"):
            if v.type in seen_types:
                continue  # only the latest row per type
            seen_types.add(v.type)
            if is_member:
                verifications[v.type] = {
                    "status": v.status,
                    "valid_until": v.valid_until,
                    "submitted_at": v.submitted_at,
                    "reviewed_at": v.reviewed_at,
                    "rejection_reason": v.rejection_reason,
                    "payload": v.payload,
                }
            elif v.status == Verification.Status.VERIFIED:
                verifications[v.type] = {"status": v.status, "valid_until": v.valid_until}

        return Response({"level": credibility_level(org), "verifications": verifications})


class VerificationSubmitView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/verifications/ — owner/admin submits a
    verification for manual review. Non-file fields go through
    `request.data`, attached PDFs through `request.FILES` (same split
    OrgLogoView already uses for the logo upload)."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        enforce_rate_limit(
            f"credibility_submit:org:{org.id}", limit=SUBMIT_RATE_LIMIT_PER_DAY, window_seconds=86400
        )
        type_ = request.data.get("type")
        if type_ not in VerificationType.values:
            return Response({"detail": "Invalid verification type."}, status=400)

        payload = {k: v for k, v in request.data.items() if k != "type"}
        files = dict(request.FILES.items())

        try:
            verification = submit_verification(org, request.user, type_, payload, files)
        except DjangoValidationError as exc:
            detail = exc.messages if hasattr(exc, "messages") else str(exc)
            return Response({"detail": detail}, status=400)

        return Response({"type": verification.type, "status": verification.status}, status=201)


class VerificationDocumentView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/verifications/<verification_id>/documents/<ref>/

    Mints a short-lived SAS URL for a document the org itself submitted.
    Deliberately scoped to the org's own owner/admin (re-viewing what they
    submitted), not the general VisibilityResolver grant system the doc
    sketches — these are pre-review source documents, not published profile
    content; investors only ever see the derived, restricted OrgFields
    written by `services._write_financial_fields` once nivel 3 is approved.
    Still writes a RestrictedAccessLog row, same audit trail as the data room.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug, verification_id, ref):
        org = self.get_org()
        verification = get_object_or_404(Verification, org=org, id=verification_id)
        match = next((r for r in verification.document_refs if r["field"] == ref), None)
        if match is None:
            return Response({"detail": "Document not found."}, status=404)

        RestrictedAccessLog.objects.create(
            viewer=request.user,
            org=org,
            field_key=f"credibility:{verification.type}:{ref}",
            section_kind="credibility",
            ip=request.META.get("REMOTE_ADDR"),
        )
        return Response({"url": private_doc_url(match["blob"])})


def _real_stripe_connect_url(org, client_id):  # pragma: no cover - no client id configured anywhere yet
    params = {
        "response_type": "code",
        "client_id": client_id,
        "scope": "read_only",
        "state": org.slug,
        "redirect_uri": f"{settings.FRONTEND_URL}/dashboard/{org.slug}?stripe_connected=1",
    }
    return f"https://connect.stripe.com/oauth/authorize?{urlencode(params)}"


def _stub_connect_stripe(org, user):
    existing = Verification.objects.filter(
        org=org, type=VerificationType.STRIPE_TRACTION, status=Verification.Status.VERIFIED
    ).first()
    if existing:
        existing.valid_until = timezone.now() + STRIPE_STUB_VALIDITY
        existing.save(update_fields=["valid_until"])
        return existing
    return Verification.objects.create(
        org=org,
        type=VerificationType.STRIPE_TRACTION,
        status=Verification.Status.VERIFIED,
        payload={"stub": True, "account_ref": f"stub_acct_{org.slug}"},
        submitted_by=user,
        reviewed_by=user,
        reviewed_at=timezone.now(),
        valid_until=timezone.now() + STRIPE_STUB_VALIDITY,
    )


class TractionConnectView(OrgLookupMixin, APIView):
    """POST /api/orgs/<slug>/traction/connect/ — nivel 4, Stripe first (doc
    §8). Same stub convention as `billing.services.get_or_create_stripe_customer`:
    with no STRIPE_SECRET_KEY/STRIPE_CONNECT_CLIENT_ID configured anywhere yet,
    this grants the `stripe_traction` Verification directly (14-day rolling
    validity, refreshed each call) instead of running a real OAuth handshake.

    The `oauth_url` branch below builds a real, spec-correct Stripe Connect
    authorize URL once a client id is configured — but completing that
    handshake needs a callback view that exchanges the returned `code` for
    an access token and *then* grants the Verification, plus a daily sync
    job to actually pull revenue data and keep the 14-day validity honest.
    Neither is built: there's no Stripe account anywhere to test them
    against yet, and half-built OAuth/webhook code that's never been
    exercised is worse than an honest stub. Swapping this in is the next
    step once real Stripe Connect credentials exist.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def post(self, request, slug):
        org = self.get_org()
        stripe_key = os.environ.get("STRIPE_SECRET_KEY")
        client_id = os.environ.get("STRIPE_CONNECT_CLIENT_ID")
        if stripe_key and client_id:
            return Response({"oauth_url": _real_stripe_connect_url(org, client_id)})

        verification = _stub_connect_stripe(org, request.user)
        return Response({"status": verification.status, "stub": True})


class BadgeEmbedView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/badge-embed/ — copy-paste snippet for external sites."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        return Response(badge_embed_html(org))


class VitalityView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/vitality/ — private checklist + presence (owner/admin)."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        return Response(vitality_state(org))
