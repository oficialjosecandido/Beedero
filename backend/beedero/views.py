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
        "compute_daily_site_stats": ("compute_daily_site_stats", []),
        "check_milestones": ("check_milestones", []),
        "send_weekly_digest": ("send_weekly_digest", []),
        "send_personal_digest": ("send_personal_digest", []),
        "send_investor_alerts": ("send_investor_alerts", []),
        "expire_jobs": ("expire_jobs", []),
        "team_invite_upkeep": ("team_invite_upkeep", []),
        "billing_reminders": ("billing_reminders", []),
        "nexus_rollup": ("nexus_rollup", []),
        "send_newsletters": ("send_newsletters", []),
        # One-off (re-runnable): reconstructs active days from before presence
        # tracking existed. Triggered by hand from manual-backfill-active-days.yml.
        "backfill_active_days": ("backfill_active_days", []),
        # Stable /p/lighthouse-demo for SEO/perf audits. Also runs from startup.sh;
        # exposed here so ops can re-seed without restarting the app.
        "ensure_lighthouse_demo_person": ("ensure_lighthouse_demo_person", []),
        # is_staff for the Nexus admin allowlist. Also runs from startup.sh;
        # exposed here because an admin's first sign-in is what creates the row
        # to promote, and that will not line up with a deploy.
        "ensure_nexus_admins": ("ensure_nexus_admins", []),
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
