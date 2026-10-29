"""Reports people filed against other people (messaging.MessageReport): a
queue to work through. Staff resolve with "no action" or "warned"; only
admins can resolve by suspending the account.

The Nexus never shows the conversation itself — messages are private to the
two people (row-level security). What the reporter wrote is the evidence.
"""

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from messaging.models import MessageReport
from notifications.models import Notification
from notifications.services import notify

from . import audit
from .access import IsNexusStaff, nexus_role, require
from .common import iso, paginate, person
from .models import NexusAction
from .people import suspend


def _row(report: MessageReport, counts: dict) -> dict:
    return {
        "id": report.id,
        "reason": report.reason,
        "reason_label": report.get_reason_display(),
        "details": report.details,
        "created_at": iso(report.created_at),
        "from_conversation": report.conversation_id is not None,
        "reporter": person(report.reporter),
        "reported": {
            **person(report.reported_user),
            "is_active": report.reported_user.is_active,
            "reports_total": counts.get(report.reported_user_id, 0),
        },
        "resolved_at": iso(report.resolved_at),
        "resolved_by": report.resolved_by.email if report.resolved_by_id else "",
        "resolution": report.resolution,
        "resolution_label": report.get_resolution_display() if report.resolution else "",
        "resolution_note": report.resolution_note,
    }


class ReportsView(APIView):
    permission_classes = [IsNexusStaff]

    def get(self, request):
        queryset = MessageReport.objects.select_related(
            "reporter__investorprofile", "reported_user__investorprofile", "resolved_by"
        )
        if request.query_params.get("state", "open") == "resolved":
            queryset = queryset.filter(resolved_at__isnull=False).order_by("-resolved_at")
        else:
            queryset = queryset.filter(resolved_at__isnull=True).order_by("created_at")
        rows, page = paginate(queryset, request)
        counts = dict(
            MessageReport.objects.filter(reported_user_id__in={r.reported_user_id for r in rows})
            .values_list("reported_user_id")
            .annotate(n=Count("id"))
        )
        return Response(
            {
                "results": [_row(report, counts) for report in rows],
                "can_suspend": nexus_role(request.user) == "admin",
                **page,
            }
        )


class ReportResolveView(APIView):
    permission_classes = [IsNexusStaff]

    def post(self, request, pk):
        report = get_object_or_404(
            MessageReport.objects.select_related("reporter__investorprofile", "reported_user__investorprofile"), pk=pk
        )
        if report.resolved_at:
            raise ValidationError({"detail": "This report is already resolved."})
        resolution = request.data.get("resolution")
        if resolution not in MessageReport.Resolution.values:
            raise ValidationError({"resolution": ["Choose what was done."]})
        note = (request.data.get("note") or "").strip()[:1000]
        if resolution == MessageReport.Resolution.SUSPENDED:
            require(request.user, "reports.suspend")
            suspend(report.reported_user, request.user, note or f"Report #{report.id}: {report.get_reason_display()}")
        elif resolution == MessageReport.Resolution.WARNED:
            notify(
                report.reported_user,
                kind=Notification.Kind.MODERATION,
                aggregate_key=f"moderation:report:{report.id}",
                title="A message of yours was reported",
                body="Someone on Beedero reported contact from you. Please keep contact respectful and relevant — "
                "repeated reports can lead to the account being suspended.",
                link="/terms",
            )
        report.resolved_at = timezone.now()
        report.resolved_by = request.user
        report.resolution = resolution
        report.resolution_note = note
        report.save(update_fields=["resolved_at", "resolved_by", "resolution", "resolution_note"])
        audit.record(
            request.user,
            NexusAction.Action.REPORT_RESOLVED,
            target_type="user",
            target_id=report.reported_user_id,
            label=report.reported_user.email,
            reason=f"Report #{report.id}: {report.get_resolution_display()}{' — ' + note if note else ''}",
            report=report.id,
        )
        counts = {report.reported_user_id: MessageReport.objects.filter(reported_user=report.reported_user).count()}
        report.reported_user.refresh_from_db()
        return Response(_row(report, counts))
