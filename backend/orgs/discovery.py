"""Discovery engine (§6) — MVP version.

Hard rule: discovery can only filter/sort by fields the viewer would be
entitled to see *on that specific* profile. Never filter over the raw table
of private/restricted fields without checking per-org visibility.

Identity filters (stage/sector/geo) live in simple, always-public columns
on Organization (see orgs/models.py) — they don't go through the generic
OrgField because they're precisely what public discovery uses for
indexing. Filters on restricted metrics (e.g. mrr) only apply for
verified investors, and even then only look at orgs where that specific
field is visible to the viewer (concrete grant), never blindly.

The per-role denormalized table is left for v2 (§8) — here it's resolved
org by org, acceptable at MVP volume.
"""

from .models import Organization
from .visibility import VisibilityResolver

RESTRICTED_METRIC_KEYS = {"mrr", "arr", "valuation"}


def _is_verified_investor(viewer) -> bool:
    if not viewer or not viewer.is_authenticated:
        return False
    profile = getattr(viewer, "investorprofile", None)
    return bool(profile and profile.is_verified)


def discover(viewer, params: dict):
    qs = Organization.objects.all()

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
        for org in qs:
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

    return qs.order_by("name")
