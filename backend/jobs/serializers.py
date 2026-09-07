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


class ApplicationInputSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1500, required=False, allow_blank=True, default="")
    external_link = serializers.URLField(required=False, allow_blank=True, default="")


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
