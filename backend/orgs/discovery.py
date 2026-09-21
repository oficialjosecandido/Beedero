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

# People search ranks in Python (completeness isn't a column), so the same
# bound applies for the same reason — and it doubles as the ceiling on how
# much of the profile table one request can walk.
MAX_PEOPLE_CANDIDATES = 500


def _is_verified_investor(viewer) -> bool:
    if not viewer or not viewer.is_authenticated:
        return False
    profile = getattr(viewer, "investorprofile", None)
    return bool(profile and profile.is_verified)


def discover(viewer, params: dict):
    qs = Organization.objects.filter(status=Organization.Status.LIVE)

    query = (params.get("q") or "").strip()
    if query:
        qs = qs.filter(
            Q(name__icontains=query) | Q(one_liner__icontains=query) | Q(slug__icontains=query)
        )

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


def location_visible_q(viewer):
    """Rows whose location section this viewer is entitled to see.

    The module's hard rule applied to city: a city filter over the raw column
    would let anyone binary-search the home town of someone who set their
    location to private — ask for each city in turn and watch who appears. So
    the filter and the density count both run behind this.

    Resolved in SQL rather than through PersonVisibilityResolver because this
    runs over the whole table; the connection set costs one query instead of
    one per candidate. `country` is the section key — city rides it, see
    accounts/public.py.
    """
    from accounts.visibility import CONNECTIONS, PUBLIC, VERIFIED_INVESTORS
    from connections.services import connected_user_ids

    # A missing key means the default, and the default is public.
    visible = Q(visibility__country=PUBLIC) | Q(visibility__country__isnull=True)
    if viewer is None or not viewer.is_authenticated:
        return visible

    visible |= Q(user_id=viewer.id)
    if _is_verified_investor(viewer):
        visible |= Q(visibility__country=VERIFIED_INVESTORS)
    connected = list(connected_user_ids(viewer))
    if connected:
        visible |= Q(visibility__country=CONNECTIONS, user_id__in=connected)
    return visible


def _people_base_qs(viewer):
    from accounts.models import InvestorProfile

    qs = InvestorProfile.objects.exclude(full_name="").select_related("user")
    if viewer is not None and viewer.is_authenticated:
        qs = qs.exclude(user_id=viewer.id)
    return qs


def discover_people(viewer, params: dict):
    from accounts.cities import normalize_city
    from accounts.completeness import profile_completeness

    qs = _people_base_qs(viewer)

    query = (params.get("q") or "").strip()
    if query:
        qs = qs.filter(
            Q(full_name__icontains=query)
            | Q(headline__icontains=query)
            | Q(handle__icontains=query)
        )

    # Local density (doc `beedero-features-onfound-analise.md` §1.1): matched
    # on the normalized key, so the filter finds "Lisboa" and "Lisbon" alike
    # whichever one the searcher typed.
    city = normalize_city(params.get("city") or "")
    if city:
        qs = qs.filter(location_visible_q(viewer), city_key=city)

    # Ordered before the cap because slicing an unordered queryset is
    # undefined, and a search whose page 2 disagrees with page 1 is a bug.
    # `-is_verified, full_name` is the closest the database can get to the
    # ranking below, so the cap drops the rows that would have ranked last.
    profiles = list(qs.order_by("-is_verified", "full_name")[:MAX_PEOPLE_CANDIDATES])
    profiles.sort(
        key=lambda p: (-profile_completeness(p), -int(p.is_verified), p.full_name.lower())
    )
    return profiles


def visible_city_ids(viewer, profiles) -> set[int]:
    """Of `profiles`, the ids whose city this viewer may be shown.

    A listing is the easiest place to leak a field by accident — it renders
    rows nobody resolved visibility for. One query over the page's ids, using
    the same rule as the filter, so the listing and the profile page can't
    drift apart.
    """
    from accounts.models import InvestorProfile

    ids = [p.pk for p in profiles if p.city]
    if not ids:
        return set()
    return set(
        InvestorProfile.objects.filter(location_visible_q(viewer), pk__in=ids).values_list(
            "pk", flat=True
        )
    )


def people_in_viewer_city(viewer):
    """"X founders in your city" — the whole reason the city field exists.

    None when the viewer hasn't declared one: the UI then has a place to ask
    for it rather than a zero to explain.
    """
    profile = getattr(viewer, "investorprofile", None) if viewer else None
    if profile is None or not profile.city_key:
        return None
    count = (
        _people_base_qs(viewer)
        .filter(location_visible_q(viewer), city_key=profile.city_key)
        .count()
    )
    return {"city": profile.city, "city_key": profile.city_key, "count": count}
