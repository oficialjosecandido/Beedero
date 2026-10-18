from rest_framework import serializers

from orgs.serializers import _org_summary

from .models import Application, CompensationKind, EngagementType, JobPost


class JobCompensationInputSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=CompensationKind.choices)
    detail = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class JobPostWriteSerializer(serializers.ModelSerializer):
    compensation = JobCompensationInputSerializer(many=True, required=False, default=list)

    class Meta:
        model = JobPost
        fields = [
            "title",
            "description",
            "role_area",
            "engagement_type",
            "location_type",
            "location_city",
            "salary_text",
            "skills",
            "compensation",
        ]

    def validate_skills(self, value):
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise serializers.ValidationError("skills must be a list of strings.")
        return value

    def validate_compensation(self, value):
        seen = set()
        for item in value:
            if item["kind"] in seen:
                raise serializers.ValidationError("Each compensation kind can only appear once.")
            seen.add(item["kind"])
        return value


class MinimumProfileSerializer(serializers.Serializer):
    """The three profile fields the apply form may carry (§3.5).

    All optional, and all ignored where the profile already has a value — see
    `accounts/minimum_profile.py`. Someone who came from a public job page and
    has no profile at all can fill these in the same form as the application,
    which is the whole point of the section.
    """

    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    headline = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")


class ApplicationInputSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1500, required=False, allow_blank=True, default="")
    external_link = serializers.URLField(required=False, allow_blank=True, default="")
    profile = MinimumProfileSerializer(required=False)


class ApplicationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Application.Status.choices)


def job_summary(job) -> dict:
    return {
        "id": job.id,
        "org": _org_summary(job.org),
        "title": job.title,
        "description": job.description,
        "role_area": job.role_area,
        "engagement_type": job.engagement_type,
        "location_type": job.location_type,
        "location_city": job.location_city,
        "salary_text": job.salary_text,
        "skills": job.skills,
        "compensation": [
            {"kind": c.kind, "detail": c.detail} for c in job.compensation.all()
        ],
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "expires_at": job.expires_at.isoformat() if job.expires_at else None,
        "renewal_count": job.renewal_count,
    }


def _applicant_summary(user) -> dict:
    profile = getattr(user, "investorprofile", None)
    return {
        "id": user.id,
        "name": profile.full_name if profile else user.email.split("@", 1)[0],
        "headline": profile.headline if profile else "",
        "handle": profile.handle if profile else "",
        "is_verified": bool(profile and profile.is_verified),
        "profile_picture": profile.profile_picture.url if profile and profile.profile_picture else None,
    }


def application_summary(application: Application) -> dict:
    return {
        "id": application.id,
        "job_id": application.job_id,
        "applicant": _applicant_summary(application.applicant),
        "note": application.note,
        "external_link": application.external_link,
        "status": application.status,
        "created_at": application.created_at.isoformat(),
    }


ENGAGEMENT_TYPE_CHOICES = EngagementType.choices


def _public_org(org) -> dict:
    """The org fields a job page may show a stranger.

    Built by hand rather than reusing `_org_summary`, which is the authenticated
    payload: §9 says public job endpoints carry "só campos públicos", and the
    way to keep that true as `_org_summary` grows is to not depend on it. Every
    field here is already visible to anyone on /o/<slug>.
    """
    from credibility.levels import credibility_level

    return {
        "slug": org.slug,
        "name": org.name,
        "one_liner": org.one_liner,
        "logo": org.logo.url if org.logo else None,
        "is_verified": org.is_verified,
        "credibility_level": credibility_level(org),
    }


def public_job(job) -> dict:
    """What an unauthenticated visitor — or Google — sees of a job.

    Deliberately not `job_summary`: that one answers an org asking about its
    own posting and includes its lifecycle (`status`, `renewal_count`). This
    answers a stranger, and a stranger only ever sees open, unexpired jobs, so
    those fields would be noise at best and a renewal history at worst.

    What is absent is the point: no applications, no applicant anything, no
    counts. §3.1 — "**Nunca** candidaturas nem dados de candidatos."
    """
    return {
        "id": job.id,
        "org": _public_org(job.org),
        "title": job.title,
        "description": job.description,
        "role_area": job.role_area,
        "engagement_type": job.engagement_type,
        "engagement_label": job.get_engagement_type_display(),
        "location_type": job.location_type,
        "location_label": job.get_location_type_display(),
        "location_city": job.location_city,
        "salary_text": job.salary_text,
        "skills": job.skills,
        "compensation": [{"kind": c.kind, "detail": c.detail} for c in job.compensation.all()],
        "created_at": job.created_at.isoformat(),
        "expires_at": job.expires_at.isoformat() if job.expires_at else None,
    }
