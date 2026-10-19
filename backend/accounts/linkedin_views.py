"""Import a profile from the person's own LinkedIn data export.

Two steps, so nothing lands on a profile unseen:

1. POST /api/profile/import/linkedin/preview/ (multipart, `files`): parse the
   export in memory and return what we found next to what the profile
   already has. Nothing is written and the file is not kept.
2. POST /api/profile/import/linkedin/apply/ (JSON): save exactly what the
   person ticked on the review screen, through the same serializers the
   profile and experience forms use.

Everything imported is self-declared — dashed on the timeline, like anything
typed by hand. Verification still only comes from an org confirming or a
registry certificate.
"""

from datetime import date

from django.db import transaction
from django.db.models.functions import Lower
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from beedero.date_bounds import DATE_YEAR_MIN
from beedero.ratelimit import enforce_rate_limit
from orgs.models import Organization, OrgMembership

from .handles import ensure_profile_handle
from .linkedin_import import LinkedInImportError, parse_linkedin_export
from .models import InvestorProfile, SelfDeclaredExperience
from .serializers import InvestorProfileSerializer, SelfDeclaredExperienceSerializer
from .skills import MAX_SKILLS, normalize_skills

MAX_APPLY_ENTRIES = 150


def _existing_keys(user) -> set[tuple]:
    """(kind, lowercased org name, start date) of everything already on the
    timeline, so a second import — or one after typing things by hand —
    doesn't double up."""
    from affiliations.models import Affiliation

    keys = {
        (e.kind, e.org_name.strip().lower(), e.started_on)
        for e in SelfDeclaredExperience.objects.filter(user=user)
    }
    for org_name, started_on in Affiliation.objects.filter(user=user).values_list(
        "org__name", "started_on"
    ):
        keys.add(("work", org_name.strip().lower(), started_on))
    for org_name, started_on in OrgMembership.objects.filter(
        user=user, started_on__isnull=False
    ).values_list("org__name", "started_on"):
        keys.add(("work", org_name.strip().lower(), started_on))
    return keys


def _key(kind, org_name, started_on):
    return (kind, (org_name or "").strip().lower(), started_on)


class LinkedInImportPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        enforce_rate_limit(f"linkedin-preview:{request.user.id}", limit=20, window_seconds=3600)
        try:
            parsed = parse_linkedin_export(request.FILES.getlist("files"))
        except LinkedInImportError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        profile = InvestorProfile.objects.filter(user=request.user).first()
        current_skills = list(profile.skills) if profile else []
        existing = _existing_keys(request.user)

        work_names = {p.org_name.lower() for p in parsed.positions}
        orgs_on_beedero = {
            org.lname: {"slug": org.slug, "name": org.name}
            for org in Organization.objects.annotate(lname=Lower("name")).filter(
                lname__in=work_names, status=Organization.Status.LIVE
            )
        }

        today = date.today()
        entries = []
        for index, entry in enumerate(parsed.positions + parsed.education):
            # An end date in the future is an expected one (a degree still in
            # progress): on Beedero that is simply "ongoing".
            ended_on = entry.ended_on if entry.ended_on and entry.ended_on <= today else None
            if entry.started_on is None:
                entry_status = "missing_start"
            elif (
                entry.started_on > today
                or entry.started_on.year < DATE_YEAR_MIN
                or (ended_on and ended_on < entry.started_on)
            ):
                # Same bounds the experience form enforces (beedero/date_bounds.py).
                entry_status = "invalid_dates"
            elif _key(entry.kind, entry.org_name, entry.started_on) in existing:
                entry_status = "already_on_profile"
            else:
                entry_status = "new"
            entries.append(
                {
                    "key": f"e{index}",
                    "kind": entry.kind,
                    "org_name": entry.org_name,
                    "role": entry.role,
                    "started_on": entry.started_on.isoformat() if entry.started_on else None,
                    "ended_on": ended_on.isoformat() if ended_on else None,
                    "status": entry_status,
                    "beedero_org": orgs_on_beedero.get(entry.org_name.lower())
                    if entry.kind == "work"
                    else None,
                }
            )

        current_lower = {s.lower() for s in current_skills}
        return Response(
            {
                "files_read": parsed.files_read,
                "profile": {
                    "full_name": {
                        "imported": parsed.full_name,
                        "current": profile.full_name if profile else "",
                    },
                    "headline": {
                        "imported": parsed.headline,
                        "current": profile.headline if profile else "",
                    },
                    "bio": {"imported": parsed.summary, "current": profile.bio if profile else ""},
                    "location": {
                        "imported": parsed.location,
                        "current_country": profile.country if profile else "",
                    },
                },
                "skills": {
                    "imported": [s for s in parsed.skills if s.lower() not in current_lower],
                    "current": current_skills,
                    "max": MAX_SKILLS,
                },
                "entries": entries,
            }
        )


class _EntrySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=SelfDeclaredExperience.Kind.choices)
    org_name = serializers.CharField(max_length=200)
    role = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    started_on = serializers.DateField()
    ended_on = serializers.DateField(allow_null=True, required=False, default=None)


class _ApplySerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    headline = serializers.CharField(max_length=200, required=False, allow_blank=True)
    bio = serializers.CharField(max_length=2600, required=False, allow_blank=True)
    country = serializers.RegexField(r"^[A-Z]{2}$", required=False)
    skills = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False, max_length=200
    )
    entries = _EntrySerializer(many=True, required=False, max_length=MAX_APPLY_ENTRIES)


class LinkedInImportApplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        enforce_rate_limit(f"linkedin-apply:{request.user.id}", limit=10, window_seconds=3600)
        payload = _ApplySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        with transaction.atomic():
            profile, _ = InvestorProfile.objects.get_or_create(user=request.user)

            changes = {}
            # Name: only ever fills an empty one — the profile form refuses
            # to change a name once set, and so does this.
            if data.get("full_name") and not profile.full_name:
                changes["full_name"] = data["full_name"]
            for field in ("headline", "bio", "country"):
                if data.get(field):
                    changes[field] = data[field]
            skills_before = list(profile.skills)
            if data.get("skills"):
                # Existing skills first: the cap trims imported ones, never
                # something the person already chose.
                changes["skills"] = normalize_skills(skills_before + data["skills"])

            if changes:
                profile_serializer = InvestorProfileSerializer(profile, data=changes, partial=True)
                profile_serializer.is_valid(raise_exception=True)
                profile_serializer.save()

            existing = _existing_keys(request.user)
            created, skipped = 0, 0
            for entry in data.get("entries", []):
                key = _key(entry["kind"], entry["org_name"], entry["started_on"])
                if key in existing:
                    skipped += 1
                    continue
                experience = SelfDeclaredExperienceSerializer(data={**entry, "skills": []})
                experience.is_valid(raise_exception=True)
                experience.save(user=request.user)
                existing.add(key)
                created += 1

            ensure_profile_handle(profile)

        profile.refresh_from_db()
        return Response(
            {
                "profile_fields_updated": sorted(k for k in changes if k != "skills"),
                "skills_added": len(profile.skills) - len(skills_before),
                "entries_created": created,
                "entries_skipped": skipped,
            },
            status=status.HTTP_200_OK,
        )
