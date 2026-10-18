"""Open positions, readable without an account — doc §3, "o maior íman".

Today a job is only visible to someone who already has a Beedero account,
which makes the single most searched-for thing on the site invisible to the
people most likely to search for it. These two endpoints feed the public
`/jobs` pages, which in turn feed Google for Jobs.

Three rules shape everything here, all from §3.1 and §9:

  - open, unexpired, and from a LIVE org, or it does not exist. A closed role
    that stays reachable is a lie with a URL;
  - public fields only, and never an application or an applicant — see
    `public_job`;
  - under `/api/public/`, the prefix the RLS middleware exempts, because the
    reader has no account and therefore no viewer id to scope rows by.

Pagination is keyset, not offset: the ordering is "newest first" over a table
that gets new rows all day, and offsets over a moving list quietly repeat and
skip entries. The cursor is opaque so that it can keep meaning the pair
(created_at, id) without anyone building a URL that depends on it.
"""

import base64
import binascii

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Organization

from .models import EngagementType, JobPost
from .serializers import public_job
from .throttles import PublicJobsThrottle

PAGE_SIZE = 20


def _open_jobs():
    """The only queryset in this module, so the three rules are stated once."""
    return (
        JobPost.objects.filter(
            status=JobPost.Status.OPEN,
            expires_at__gt=timezone.now(),
            org__status=Organization.Status.LIVE,
        )
        .select_related("org")
        .prefetch_related("compensation")
    )


def _encode_cursor(job: JobPost) -> str:
    raw = f"{job.created_at.isoformat()}|{job.id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(value: str):
    """`(created_at, id)` or None. A cursor we didn't write means page one.

    Never an error: this is a public URL, and a visitor who truncated it in a
    chat app should get the first page, not a 400 explaining base64 to them.
    """
    if not value:
        return None
    try:
        padded = value + "=" * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode()).decode()
        timestamp, _, job_id = decoded.partition("|")
        parsed = timezone.datetime.fromisoformat(timestamp)
        return parsed, int(job_id)
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return None


class PublicJobsView(APIView):
    """GET /api/public/jobs/?type=&location=&city=&area=&cursor="""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PublicJobsThrottle]

    def get(self, request):
        params = request.query_params
        qs = _open_jobs()

        # Unknown filter values narrow to nothing rather than being ignored:
        # a page that says "Remote · Design" must not list office jobs because
        # the value was misspelt. Choices are validated so the error is an
        # empty list, not a 500 on a bad enum.
        engagement = (params.get("type") or "").strip().lower()
        if engagement:
            if engagement not in EngagementType.values:
                return self._empty()
            qs = qs.filter(engagement_type=engagement)

        location = (params.get("location") or "").strip().lower()
        if location:
            if location not in JobPost.LocationType.values:
                return self._empty()
            qs = qs.filter(location_type=location)

        city = (params.get("city") or "").strip()
        if city:
            # Remote roles have no city, so filtering by one must not hide the
            # remote jobs a person in that city can actually take.
            qs = qs.filter(
                Q(location_city__iexact=city) | Q(location_type=JobPost.LocationType.REMOTE)
            )

        area = (params.get("area") or "").strip()
        if area:
            qs = qs.filter(role_area__icontains=area[:60])

        qs = qs.order_by("-created_at", "-id")

        cursor = _decode_cursor(params.get("cursor", ""))
        if cursor:
            created_at, job_id = cursor
            qs = qs.filter(
                Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=job_id)
            )

        # One extra row answers "is there a next page?" without a second query.
        page = list(qs[: PAGE_SIZE + 1])
        has_more = len(page) > PAGE_SIZE
        page = page[:PAGE_SIZE]

        return Response(
            {
                "items": [public_job(job) for job in page],
                "next_cursor": _encode_cursor(page[-1]) if has_more and page else None,
                # Deliberately no `total`: counting the whole table on every
                # public request is the easy way to make a cheap page expensive,
                # and §9's "contagens públicas só com números reais" is about
                # headline claims, not a result count nobody reads.
            }
        )

    def _empty(self):
        return Response({"items": [], "next_cursor": None})


class PublicJobDetailView(APIView):
    """GET /api/public/jobs/<id>/ — one open role, or a 404.

    A role that has been filled, withdrawn or left to expire 404s rather than
    rendering as "closed": §3.3 allows either, and 404 is the one that cannot
    end up in Google's job index describing something that no longer exists.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PublicJobsThrottle]

    def get(self, request, job_id):
        job = get_object_or_404(_open_jobs(), pk=job_id)
        return Response(public_job(job))
