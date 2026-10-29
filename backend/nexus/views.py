"""Who am I in the Nexus, the home queues, the Overview and the audit log."""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from credibility.models import Verification
from messaging.models import MessageReport
from orgs.models import Activity, Organization, Visibility

from . import audit
from .access import CAPABILITIES, IsNexusAdmin, IsNexusStaff, nexus_role
from .common import paginate, person
from .kpis import overview
from .models import NexusAction


class MeView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request):
        role = nexus_role(request.user)
        return Response({**person(request.user), "role": role, "capabilities": sorted(CAPABILITIES[role])})


class HomeView(APIView):
    """The work waiting, for staff and admins alike."""

    permission_classes = [IsNexusStaff]

    def get(self, request):
        now = timezone.now()
        pending = Verification.objects.filter(status=Verification.Status.PENDING)
        oldest = pending.order_by("submitted_at").values_list("submitted_at", flat=True).first()
        oldest_report = (
            MessageReport.objects.filter(resolved_at__isnull=True)
            .order_by("created_at")
            .values_list("created_at", flat=True)
            .first()
        )
        return Response(
            {
                "queues": {
                    "reports_open": MessageReport.objects.filter(resolved_at__isnull=True).count(),
                    "oldest_report_days": (now - oldest_report).days if oldest_report else None,
                    "verifications_pending": pending.count(),
                    "oldest_verification_days": (now - oldest).days if oldest else None,
                    "posts_24h": Activity.objects.filter(
                        Q(visibility=Visibility.PUBLIC) | Q(org__isnull=True), created_at__gte=now - timedelta(hours=24)
                    ).count(),
                    "orgs_24h": Organization.objects.filter(created_at__gte=now - timedelta(hours=24)).count(),
                },
                "recent_actions": [
                    audit.serialize(row)
                    for row in NexusAction.objects.filter(actor=request.user)[:10]
                ],
            }
        )


class OverviewView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request):
        return Response(overview())


class AuditView(APIView):
    permission_classes = [IsNexusAdmin]

    def get(self, request):
        queryset = NexusAction.objects.all()
        action = request.query_params.get("action")
        if action:
            queryset = queryset.filter(action__startswith=action)
        actor = request.query_params.get("actor")
        if actor:
            queryset = queryset.filter(actor_email__icontains=actor)
        q = (request.query_params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(Q(target_label__icontains=q) | Q(reason__icontains=q) | Q(target_id=q))
        rows, page = paginate(queryset, request)
        return Response(
            {
                "results": [audit.serialize(row) for row in rows],
                "actions": [{"key": key, "label": label} for key, label in NexusAction.Action.choices],
                **page,
            }
        )
