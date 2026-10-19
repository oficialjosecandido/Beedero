"""The activation funnel, broken down by where people came from.

Doc `beedero-aquisicao-pessoas.md` §8.3. One number decides whether a channel
is worth more of anyone's time, and it is not registrations:

    Registos → Perfil ≥ 60% → 1.ª ligação → Voltou em 7 dias

The doc's headline metric (§0) is *activated* people per week — "registo +
perfil ≥ 60% + pelo menos uma ligação nos primeiros 7 dias" — and it says
plainly that "registos sozinhos não contam". A channel that delivers a hundred
accounts and four activations is worse than one that delivers ten and six, and
only a per-origin funnel shows the difference.

Definitions are pinned here, in one module, rather than inline in the admin
view, because a metric that is computed in two places soon means two different
things.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils.timezone import now

from .completeness import profile_completion

User = get_user_model()

WINDOW_DAYS = 30

# §0: "perfil ≥ 60%". Measured against profile_completion — the self-declared
# fields the person actually types — and not against `WEIGHTS`/profile_completeness.
# Two reasons: WEIGHTS is the discovery-ranking input and counts things that are
# not profile fields at all (joining an org, posting), so a "profile" threshold
# built on it would double-count the connection step below; and completion is
# scored by plain count, so this threshold cannot drift when someone edits the
# ranking weights.
PROFILE_THRESHOLD = 60

# What counts as a first connection, per §0: "seguir, conexão, candidatura ou
# vínculo aceite". Each entry is a queryset builder over user ids, kept as a
# separate callable so a missing app degrades to "nobody connected that way"
# rather than taking the whole admin page down.
#
# `created_at` is not filtered against the user's own signup date: every user
# considered here joined inside the window, so anything they did is inside it
# too. The "primeiros 7 dias" part of the headline metric is the returned-in-7d
# step; this step is "has ever connected at all", which is the weaker and more
# honest claim for the cohort that joined yesterday.
def _follow_user_ids(user_ids):
    from orgs.models import OrgFollow

    return OrgFollow.objects.filter(user_id__in=user_ids).values_list("user_id", flat=True)


def _connection_user_ids(user_ids):
    from django.db.models import Q

    from connections.models import Connection

    # Connection stores an ordered pair (user_one_id < user_two_id), so a
    # person can be on either side and both sides count as connected.
    pairs = Connection.objects.filter(
        Q(user_one_id__in=user_ids) | Q(user_two_id__in=user_ids)
    ).values_list("user_one_id", "user_two_id")
    ids = set()
    for one, two in pairs:
        ids.add(one)
        ids.add(two)
    return ids


def _application_user_ids(user_ids):
    from jobs.models import Application

    return Application.objects.filter(applicant_id__in=user_ids).values_list(
        "applicant_id", flat=True
    )


def _affiliation_user_ids(user_ids):
    from affiliations.models import Affiliation

    # Accepted means the person did something: a row the org created and nobody
    # confirmed is not a connection the person made.
    return Affiliation.objects.filter(
        user_id__in=user_ids,
        status__in=[Affiliation.Status.VERIFIED, Affiliation.Status.SELF_DECLARED],
    ).values_list("user_id", flat=True)


_CONNECTION_SOURCES = (
    _follow_user_ids,
    _connection_user_ids,
    _application_user_ids,
    _affiliation_user_ids,
)


def connected_user_ids(user_ids) -> set[int]:
    """Of `user_ids`, those who have made at least one connection of any kind."""
    if not user_ids:
        return set()
    connected: set[int] = set()
    for builder in _CONNECTION_SOURCES:
        try:
            connected.update(builder(user_ids))
        except Exception:
            # One unavailable signal must not erase the other three. The page
            # is a dashboard, not a ledger: an undercount with the rest intact
            # beats a 500.
            continue
    return connected & set(user_ids)


def returned_user_ids(users) -> set[int]:
    """Who came back on a later day within their first week: an active day
    (analytics.UserActiveDay) between day 1 and day 7 after the day they
    joined, both in Lisbon time.

    This used to read `last_login`, which bearer-token auth never updates —
    it only moves on an /admin sign-in — so the step read ~0 for everyone.
    Active days are written on every authenticated request
    (accounts/activity.py), plus a backfill for the time before.
    """
    from analytics.models import UserActiveDay

    from .activity import local_day

    joined = {u.id: local_day(u.date_joined) for u in users}
    if not joined:
        return set()
    returned = set()
    for user_id, day in UserActiveDay.objects.filter(user_id__in=joined).values_list(
        "user_id", "day"
    ):
        if timedelta(days=1) <= day - joined[user_id] <= timedelta(days=7):
            returned.add(user_id)
    return returned


def _funnel_row(label, users, profile_ok, connected, returned_ids) -> dict:
    registered = len(users)
    with_profile = sum(1 for u in users if u.id in profile_ok)
    with_connection = sum(1 for u in users if u.id in connected)
    returned = sum(1 for u in users if u.id in returned_ids)
    # Activated, per §0: all three, not any of them.
    activated = sum(
        1 for u in users if u.id in profile_ok and u.id in connected
    )

    def pct(part, whole):
        return round(100 * part / whole) if whole else None

    return {
        "label": label,
        "registered": registered,
        "with_profile": with_profile,
        "with_profile_pct": pct(with_profile, registered),
        "with_connection": with_connection,
        "with_connection_pct": pct(with_connection, with_profile),
        "returned": returned,
        "returned_pct": pct(returned, with_connection),
        "activated": activated,
        "activated_pct": pct(activated, registered),
    }


def acquisition_funnel(*, window_days: int = WINDOW_DAYS) -> dict:
    """The §8.3 funnel: one row per origin, plus a total row.

    Everything is computed from one pass over the window's users, because the
    alternative — a query per origin per step — is twenty-odd round trips for a
    page that already answers in one.
    """
    since = now() - timedelta(days=window_days)
    # No `.only()`: profile_completion reads eight InvestorProfile fields, and
    # deferring any of them would turn this into a query per user.
    # Staff and accounts marked internal (tests, the team) are not a channel.
    users = list(
        User.objects.filter(date_joined__gte=since, is_staff=False, is_internal=False)
        .select_related("investorprofile")
    )

    profile_ok = set()
    for user in users:
        profile = getattr(user, "investorprofile", None)
        if profile is not None and profile_completion(profile)["percent"] >= PROFILE_THRESHOLD:
            profile_ok.add(user.id)

    connected = connected_user_ids([u.id for u in users])
    returned_ids = returned_user_ids(users)

    by_source: dict[str, list] = {}
    for user in users:
        # Blank means nobody told us — usually someone who typed the address in
        # or returned to a bookmark. Named rather than hidden, because it is
        # normally the largest bucket and pretending otherwise makes every
        # measured channel look bigger than it is.
        by_source.setdefault(user.signup_source or "direct/unknown", []).append(user)

    rows = [
        _funnel_row(source, cohort, profile_ok, connected, returned_ids)
        for source, cohort in sorted(
            by_source.items(), key=lambda kv: (-len(kv[1]), kv[0])
        )
    ]

    # The detail half, for reading by eye: which job, which university. Only
    # refs that differ from their own source are worth a line.
    ref_counts: dict[str, int] = {}
    for user in users:
        if user.signup_ref and user.signup_ref != user.signup_source:
            ref_counts[user.signup_ref] = ref_counts.get(user.signup_ref, 0) + 1
    top_refs = [
        {"ref": ref, "count": count}
        for ref, count in sorted(ref_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:15]
    ]

    return {
        "window_days": window_days,
        "profile_threshold": PROFILE_THRESHOLD,
        "rows": rows,
        "total": _funnel_row("All origins", users, profile_ok, connected, returned_ids),
        "top_refs": top_refs,
    }
