from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.permissions import IsOrgOwnerOrAdmin, OrgLookupMixin

from .models import Application, JobPost
from .permissions import is_org_owner_or_admin
from .serializers import (
    ApplicationInputSerializer,
    ApplicationStatusSerializer,
    JobPostWriteSerializer,
    application_summary,
    job_summary,
)
from .services import apply_to_job, close_job, create_job, renew_job, set_application_status, update_job


class OrgJobsListCreateView(OrgLookupMixin, APIView):
    """GET/POST /api/orgs/<slug>/jobs/ — owner/admin sees every status,
    creating publishes immediately (see jobs/services.py::create_job)."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug):
        org = self.get_org()
        jobs = org.jobs.all()
        return Response({"items": [job_summary(job) for job in jobs]})

    def post(self, request, slug):
        org = self.get_org()
        serializer = JobPostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        compensation = data.pop("compensation", [])
        job = create_job(org, created_by=request.user, compensation_kinds=compensation, **data)
        return Response(job_summary(job), status=status.HTTP_201_CREATED)


class OrgJobDetailView(OrgLookupMixin, APIView):
    """PATCH/DELETE /api/orgs/<slug>/jobs/<id>/"""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def _get_job(self, slug, job_id):
        org = self.get_org()
        return get_object_or_404(JobPost, pk=job_id, org=org)

    def patch(self, request, slug, job_id):
        job = self._get_job(slug, job_id)
        partial_data = request.data
        if set(partial_data.keys()) == {"status"} and partial_data.get("status") == JobPost.Status.CLOSED:
            close_job(job)
            return Response(job_summary(job))
        serializer = JobPostWriteSerializer(job, data=partial_data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        compensation = data.pop("compensation", None)
        job = update_job(job, compensation_kinds=compensation, **data)
        return Response(job_summary(job))

    def delete(self, request, slug, job_id):
        job = self._get_job(slug, job_id)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobRenewView(APIView):
    """POST /api/jobs/<id>/renew/ — owner/admin, one click (spec §3b)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        job = get_object_or_404(JobPost, pk=job_id)
        if not is_org_owner_or_admin(job.org, request.user):
            return Response({"detail": "Not found."}, status=404)
        job = renew_job(job)
        return Response(job_summary(job))


class JobsDiscoveryView(APIView):
    """GET /api/jobs/?type=&location=&skills=&area=&verified=&q=&limit=&offset=

    Authenticated, like the other Discover surfaces — copies
    DiscoveryView's offset/limit/has-more shape exactly."""

    permission_classes = [permissions.IsAuthenticated]

    DEFAULT_LIMIT = 20
    MAX_LIMIT = 50

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit."}, status=400)
        limit = max(1, min(limit, self.MAX_LIMIT))

        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid offset."}, status=400)

        qs = JobPost.objects.filter(status=JobPost.Status.OPEN).select_related("org")

        params = request.query_params
        if params.get("type"):
            qs = qs.filter(engagement_type=params["type"])
        if params.get("location"):
            qs = qs.filter(location_type=params["location"])
        if params.get("area"):
            qs = qs.filter(role_area__icontains=params["area"])
        if params.get("verified") == "true":
            qs = qs.filter(org__is_verified=True)
        query = (params.get("q") or "").strip()
        if query:
            qs = qs.filter(title__icontains=query)
        skill = params.get("skills")
        if skill:
            qs = qs.filter(skills__contains=[skill])

        page = list(qs[offset : offset + limit + 1])
        has_more = len(page) > limit
        page = page[:limit]

        return Response(
            {
                "items": [job_summary(job) for job in page],
                "next_offset": offset + limit if has_more else None,
            }
        )


class JobApplyView(APIView):
    """POST /api/jobs/<id>/apply/ — body {note, external_link}."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        job = get_object_or_404(JobPost, pk=job_id)
        serializer = ApplicationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = apply_to_job(job, request.user, **serializer.validated_data)
        return Response(application_summary(application), status=status.HTTP_201_CREATED)


class OrgJobApplicationsView(OrgLookupMixin, APIView):
    """GET /api/orgs/<slug>/jobs/<id>/applications/ — owner/admin only."""

    permission_classes = [permissions.IsAuthenticated, IsOrgOwnerOrAdmin]

    def get(self, request, slug, job_id):
        org = self.get_org()
        job = get_object_or_404(JobPost, pk=job_id, org=org)
        applications = job.applications.select_related("applicant", "applicant__investorprofile")
        return Response({"items": [application_summary(a) for a in applications]})


class ApplicationStatusView(APIView):
    """POST /api/applications/<id>/status/ — body {status}."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        application = get_object_or_404(Application, pk=application_id)
        if not is_org_owner_or_admin(application.job.org, request.user):
            return Response({"detail": "Not found."}, status=404)
        serializer = ApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application = set_application_status(
                application, serializer.validated_data["status"], request.user
            )
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        return Response(application_summary(application))
