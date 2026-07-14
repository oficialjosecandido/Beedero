import os
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


def healthz(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_POST
def run_management_job(request):
    """Protected endpoint for scheduled jobs (GitHub Actions / Azure WebJob)."""
    secret = os.environ.get("MANAGEMENT_SECRET", "")
    if not secret or request.headers.get("X-Management-Secret") != secret:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    job = request.headers.get("X-Management-Job", "")
    allowed = {
        "expire_verifications": ("expire_verifications", []),
        "prune_profile_views": ("prune_profile_views", []),
        "sentry_test": ("sentry_test", []),
        "compute_daily_org_stats": ("compute_daily_org_stats", []),
        "check_milestones": ("check_milestones", []),
        "send_weekly_digest": ("send_weekly_digest", []),
    }
    if job not in allowed:
        return JsonResponse({"detail": "Unknown job"}, status=400)

    command, args = allowed[job]
    out = StringIO()
    try:
        call_command(command, *args, stdout=out)
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=500)

    return JsonResponse({"job": job, "output": out.getvalue()})
