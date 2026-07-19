"""Discovery engine (§6) — MVP version.

Hard rule: discovery can only filter/sort by fields the viewer would be
entitled to see *on that specific* profile. Never filter over the raw table
of private/restricted fields without checking per-org visibility.

Identity filters (stage/sector/geo) live in simple, always-public columns
on Organization (see orgs/models.py) — they don't go through the generic
OrgField because they're precisely what public discovery uses for
indexing. `geo` means where the org's HQ / main team is based (not
customer markets or legal registration). Filters on restricted metrics (e.g. mrr) only apply for
verified investors, and even then only look at orgs where that specific
field is visible to the viewer (concrete grant), never blindly.

The per-role denormalized table is left for v2 (§8) — here it's resolved
org by org, capped at MAX_METRIC_CANDIDATES per request so a broad
stage/sector/geo filter combined with a metric filter can't force
resolving an unbounded number of orgs synchronously.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Activity, Organization
from .posting.freshness import discovery_score
from .visibility import VisibilityResolver

RESTRICTED_METRIC_KEYS = {"mrr", "arr", "valuation"}

# P1.8: each candidate needs its own VisibilityResolver (its own grant
# lookups) — this bounds per-request cost independent of how large the
# LIVE org table grows.
MAX_METRIC_CANDIDATES = 500


def _is_verified_investor(viewer) -> bool:
    if not viewer or not viewer.is_authenticated:
        return False
    profile = getattr(viewer, "investorprofile", None)
    return bool(profile and profile.is_verified)


def discover(viewer, params: dict):
    qs = Organization.objects.filter(status=Organization.Status.LIVE)

    query = (params.get("q") or "").strip()
    if query:
        qs = qs.filter(Q(name__icontains=query) | Q(one_liner__icontains=query))

    if params.get("stage"):
        qs = qs.filter(stage=params["stage"])
    if params.get("sector"):
        qs = qs.filter(sector=params["sector"])
    if params.get("geo"):
        qs = qs.filter(geo=params["geo"])
    if params.get("fundraising") == "true":
        qs = qs.filter(is_fundraising=True)

    metric_key = params.get("metric")
    metric_min = params.get("metric_min")
    if metric_key in RESTRICTED_METRIC_KEYS and metric_min is not None:
        if not _is_verified_investor(viewer):
            # unverified user: restricted filter is ignored, never
            # applied blindly.
            return qs.order_by("name")
        try:
            threshold = float(metric_min)
        except ValueError:
            return qs.order_by("name")

        matching_ids = []
        for org in qs.order_by("name")[:MAX_METRIC_CANDIDATES]:
            resolver = VisibilityResolver(viewer=viewer, org=org)
            field = resolver.visible_fields().filter(key=metric_key).first()
            if field is None:
                continue
            try:
                if float(field.value) >= threshold:
                    matching_ids.append(org.id)
            except (TypeError, ValueError):
                continue
        qs = qs.filter(id__in=matching_ids)

    min_credibility = params.get("min_credibility")
    if min_credibility is not None:
        try:
            threshold = int(min_credibility)
        except ValueError:
            return qs.order_by("name")
        # credibility_level() is derived, not a column — same
        # MAX_METRIC_CANDIDATES bound as the restricted-metric filter above,
        # for the same reason (unbounded per-org computation).
        from credibility.levels import credibility_level

        candidates = list(qs.order_by("name")[:MAX_METRIC_CANDIDATES])
        matching_ids = [org.id for org in candidates if credibility_level(org) >= threshold]
        qs = qs.filter(id__in=matching_ids)

    if params.get("sort") == "credibility":
        from credibility.levels import credibility_level

        candidates = list(qs.order_by("name")[:MAX_METRIC_CANDIDATES])
        candidates.sort(key=lambda org: (-discovery_score(org), org.name))
        return candidates

    return qs.order_by("name")


def discover_active_this_week(viewer, limit=12):
    """Orgs with a post in the last 7 days, credibility level 1+, ranked by score."""
    from credibility.levels import credibility_level

    week_ago = timezone.now() - timedelta(days=7)
    active_org_ids = (
        Activity.objects.filter(org__status=Organization.Status.LIVE, created_at__gte=week_ago)
        .values_list("org_id", flat=True)
        .distinct()
    )
    orgs = Organization.objects.filter(id__in=active_org_ids, status=Organization.Status.LIVE)
    candidates = [org for org in orgs if credibility_level(org) >= 1]
    candidates.sort(key=lambda org: (-discovery_score(org), org.name))
    return candidates[:limit]


def discover_people(viewer, params: dict):
    from accounts.completeness import profile_completeness
    from accounts.models import InvestorProfile

    qs = InvestorProfile.objects.exclude(full_name="").select_related("user")
    if viewer is not None and viewer.is_authenticated:
        qs = qs.exclude(user_id=viewer.id)

    query = (params.get("q") or "").strip()
    if query:
        qs = qs.filter(Q(full_name__icontains=query) | Q(headline__icontains=query))

    profiles = list(qs)
    profiles.sort(
        key=lambda p: (-profile_completeness(p), -int(p.is_verified), p.full_name.lower())
    )
    return profiles
