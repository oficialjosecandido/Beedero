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
from .posting.freshness import discovery_score, prime_last_activity
from .visibility import visible_fields_for_orgs

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
    from .ladder import listed_in_discover

    # Live *and* past the ladder's gate (orgs/ladder.py, rungs 1–4).
    qs = listed_in_discover(Organization.objects.all())

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

        candidate_ids = list(
            qs.order_by("name").values_list("id", flat=True)[:MAX_METRIC_CANDIDATES]
        )
        # One pass over the candidates' visible fields instead of a
        # VisibilityResolver (five or six queries) per candidate.
        matching_ids = []
        for org_id, value in (
            visible_fields_for_orgs(viewer, candidate_ids)
            .filter(key=metric_key)
            .values_list("section__org_id", "value")
        ):
            try:
                if float(value) >= threshold:
                    matching_ids.append(org_id)
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
        # for the same reason (unbounded per-org computation), but resolved
        # for the whole candidate set in one query.
        from credibility.levels import credibility_levels

        candidate_ids = list(
            qs.order_by("name").values_list("id", flat=True)[:MAX_METRIC_CANDIDATES]
        )
        levels = credibility_levels(candidate_ids)
        matching_ids = [org_id for org_id in candidate_ids if levels.get(org_id, 0) >= threshold]
        qs = qs.filter(id__in=matching_ids)

    if params.get("sort") == "credibility":
        candidates = rank_by_score(qs.order_by("name")[:MAX_METRIC_CANDIDATES])
        return candidates

    return qs.order_by("name")


def rank_by_score(orgs, *, limit=None):
    """Sort orgs by `discovery_score` — two queries for the whole list.

    `discovery_score` reads the credibility level and the last activity, both
    derived rather than columns, so ranking used to cost two queries per
    candidate. Priming resolves each in a single grouped query first; the sort
    itself then touches no database at all.
    """
    from credibility.levels import prime_credibility_levels

    candidates = prime_last_activity(prime_credibility_levels(orgs))
    candidates.sort(key=lambda org: (-discovery_score(org), org.name))
    return candidates[:limit] if limit is not None else candidates


def discover_active_this_week(viewer, limit=12):
    """Orgs with a post in the last 7 days, credibility level 1+, ranked by score."""
    from credibility.levels import credibility_level

    week_ago = timezone.now() - timedelta(days=7)
    active_org_ids = (
        Activity.objects.filter(org__status=Organization.Status.LIVE, created_at__gte=week_ago)
        .values_list("org_id", flat=True)
        .distinct()
    )
    from .ladder import listed_in_discover

    orgs = listed_in_discover(Organization.objects.filter(id__in=active_org_ids))
    # Primed first, so the level filter and the ranking below read the same
    # cached values instead of querying per org.
    candidates = [org for org in rank_by_score(orgs) if credibility_level(org) >= 1]
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
    from accounts.ladder import discoverable
    from accounts.models import InvestorProfile

    # Only people past the ladder's gate (rungs 1–4) are listed or counted,
    # and never an internal account.
    qs = discoverable(InvestorProfile.objects.all()).select_related("user")
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
