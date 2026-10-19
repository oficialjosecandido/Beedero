"""Reconstruct past active days from actions already in the database.

Presence tracking (accounts/activity.py) only starts the day it's deployed.
Every person who signed up before that would otherwise have no history, and
the first honest retention curve would be weeks away. But most of what people
do on Beedero already leaves a timestamped row: posting, messaging, sending or
answering a connection request, viewing a profile, reading notifications,
reacting, applying to a job… Each of those proves the person was here that
day.

So this command writes one `UserActiveDay(inferred=True)` per person per day
on which any of those rows exists, plus the day they joined. It is a LOWER
BOUND: a day someone only scrolled and left wrote nothing, so it's missing.
Real observations (inferred=False) are never touched.

RLS: messages, connections, posts, reactions and co-founder rows are behind
row-level security keyed on `beedero.viewer_id`. Rather than needing a role
that bypasses it, this sets the viewer to each person in turn and reads only
that person's own rows — exactly what the policies already allow.

Safe to re-run (idempotent). `--dry-run` reports without writing.
"""

from collections import Counter

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models.functions import TruncDate

from accounts.activity import LISBON, local_day
from analytics.models import UserActiveDay

# (model label, field pointing at the person who ACTED, timestamp of the act).
# Only actor fields: the recipient of a message or the subject of a profile
# view did nothing that day.
ACTION_SOURCES = [
    ("accounts.InvestorPost", "author", "created_at"),
    ("accounts.InvestorProfile", "user", "onboarding_completed_at"),
    ("accounts.SelfDeclaredExperience", "user", "created_at"),
    ("orgs.Activity", "author", "created_at"),
    ("orgs.OrgInvite", "created_by", "created_at"),
    ("orgs.OrgVisit", "user", "created_at"),
    ("orgs.OrgFollow", "user", "created_at"),
    ("orgs.VisibilityGrant", "granted_by", "granted_at"),
    ("orgs.RestrictedAccessLog", "viewer", "accessed_at"),
    ("analytics.ProfileView", "viewer", "viewed_at"),
    ("analytics.PersonProfileView", "viewer", "viewed_at"),
    ("analytics.InterestSignal", "investor", "created_at"),
    ("analytics.ActivityFeedImpression", "viewer", "viewed_at"),
    ("analytics.PipelineEntry", "investor", "created_at"),
    ("credibility.Verification", "submitted_by", "submitted_at"),
    ("credibility.ProfessionalCredential", "user", "submitted_at"),
    ("social.Reaction", "user", "created_at"),
    ("social.Comment", "author", "created_at"),
    ("social.EventParticipation", "user", "created_at"),
    ("notifications.Notification", "user", "read_at"),
    ("notifications.PushSubscription", "user", "created_at"),
    ("messaging.Message", "sender", "created_at"),
    ("messaging.OrgMessage", "sender", "created_at"),
    ("messaging.UserBlock", "blocker", "created_at"),
    ("messaging.MessageReport", "reporter", "created_at"),
    ("connections.ConnectionRequest", "requester", "created_at"),
    ("connections.ConnectionRequest", "recipient", "responded_at"),
    ("advisory.AdvisorProfile", "user", "created_at"),
    ("jobs.Application", "applicant", "created_at"),
    ("affiliations.Affiliation", "created_by", "created_at"),
    ("affiliations.TeamInvite", "invited_by", "created_at"),
    ("investments.InvestmentRecord", "declared_by", "created_at"),
    ("investments.InvestmentRecord", "confirmed_by", "confirmed_at"),
    ("cofounder.BuilderProfile", "user", "created_at"),
    ("cofounder.CofounderInterest", "actor", "created_at"),
]


def _resolve_sources():
    """Skip (rather than crash on) any source whose app or field is gone, so
    a later refactor degrades the backfill instead of breaking it."""
    resolved = []
    for label, user_field, ts_field in ACTION_SOURCES:
        try:
            model = apps.get_model(label)
            model._meta.get_field(user_field)
            model._meta.get_field(ts_field)
        except (LookupError, ValueError):
            continue
        resolved.append((f"{label}.{ts_field}", model, user_field, ts_field))
    return resolved


def _set_viewer(value: str):
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('beedero.viewer_id', %s, true)", [value])


def _current_viewer() -> str:
    if connection.vendor != "postgresql":
        return "0"
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('beedero.viewer_id', true)")
        return cursor.fetchone()[0] or "0"


class Command(BaseCommand):
    help = "Writes inferred UserActiveDay rows from actions already in the database."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report only; write nothing.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        sources = _resolve_sources()
        User = get_user_model()

        previous_viewer = _current_viewer()
        per_source = Counter()
        rows = []
        try:
            for user_id, joined in User.objects.values_list("id", "date_joined").order_by("id"):
                days = {local_day(joined)}
                per_source["accounts.User.date_joined"] += 1
                with transaction.atomic():
                    _set_viewer(str(user_id))
                    for name, model, user_field, ts_field in sources:
                        found = set(
                            model.objects.filter(
                                **{f"{user_field}_id": user_id, f"{ts_field}__isnull": False}
                            )
                            .annotate(_day=TruncDate(ts_field, tzinfo=LISBON))
                            .values_list("_day", flat=True)
                            .distinct()
                        )
                        per_source[name] += len(found)
                        days |= found
                rows.extend(UserActiveDay(user_id=user_id, day=d, inferred=True) for d in days)
        finally:
            _set_viewer(previous_viewer)

        before = UserActiveDay.objects.count()
        if not dry_run:
            # ignore_conflicts: an existing row — observed or inferred — wins.
            UserActiveDay.objects.bulk_create(rows, ignore_conflicts=True, batch_size=1000)
        written = UserActiveDay.objects.count() - before

        for name, n in sorted(per_source.items(), key=lambda kv: -kv[1]):
            if n:
                self.stdout.write(f"  {name}: {n} person-day(s)")
        verb = "would write up to" if dry_run else "wrote"
        self.stdout.write(
            self.style.SUCCESS(
                f"{len(rows)} inferred person-day(s) found across "
                f"{len({r.user_id for r in rows})} people; {verb} "
                f"{len(rows) if dry_run else written} new row(s)."
            )
        )
