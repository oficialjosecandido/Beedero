from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.ratelimit import enforce_rate_limit

from .credential_services import submit_credential
from .models import ProfessionalCredential

SUBMIT_RATE_LIMIT_PER_DAY = 5


def _credential_summary(credential: ProfessionalCredential) -> dict:
    return {
        "id": credential.id,
        "title": credential.title,
        "issuer": credential.issuer,
        "identifier": credential.identifier,
        "status": credential.status,
        "submitted_at": credential.submitted_at,
        "reviewed_at": credential.reviewed_at,
        "rejection_reason": credential.rejection_reason,
        "verified_at": credential.verified_at,
    }


class ProfessionalCredentialSubmitView(APIView):
    """POST /api/credentials/ — self-service submission for manual review.
    Mirrors credibility.views.VerificationSubmitView's split of non-file
    fields via request.data and the PDF via request.FILES."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        enforce_rate_limit(
            f"credential_submit:user:{request.user.id}", limit=SUBMIT_RATE_LIMIT_PER_DAY, window_seconds=86400
        )
        title = str(request.data.get("title") or "").strip()
        issuer = str(request.data.get("issuer") or "").strip()
        identifier = str(request.data.get("identifier") or "").strip()
        if not title or not issuer or not identifier:
            return Response({"detail": "Title, issuer, and identifier are required."}, status=400)

        try:
            credential = submit_credential(
                request.user,
                title=title,
                issuer=issuer,
                identifier=identifier,
                file=request.FILES.get("document"),
            )
        except DjangoValidationError as exc:
            detail = exc.messages if hasattr(exc, "messages") else str(exc)
            return Response({"detail": detail}, status=400)

        return Response(_credential_summary(credential), status=201)


class ProfessionalCredentialMineView(APIView):
    """GET /api/credentials/mine/ — the caller's own credentials, every status."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        credentials = ProfessionalCredential.objects.filter(user=request.user).order_by("-submitted_at")
        return Response([_credential_summary(c) for c in credentials])
