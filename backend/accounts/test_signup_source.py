"""Where people came from — doc `beedero-aquisicao-pessoas.md` §8.

The point of these tests is not that a string round-trips. It is that the four
claims the funnel rests on actually hold: the origin is written once, it cannot
be rewritten later, it never lands on somebody who was already a member, and a
crafted `?ref=` cannot put arbitrary text into the column the admin groups by.
"""

import pytest
from django.core.cache import cache
from django.utils import timezone

from accounts.acquisition import acquisition_funnel
from accounts.activity import local_day
from accounts.models import InvestorProfile, User
from accounts.provisioning import get_or_provision_firebase_user
from accounts.signup_source import claim_ref, parse_ref, stash_ref
from analytics.models import UserActiveDay
from orgs.models import OrgFollow, Organization


@pytest.fixture(autouse=True)
def _clear_cache(request):
    # stash_ref lives in the cache, and the cache is a shared database table —
    # a leftover from one test would attribute the next test's signup. Skipped
    # for the pure-function tests below, which have no database and must not
    # acquire one just to clear a cache they never touch.
    if request.node.get_closest_marker("django_db") is None:
        yield
        return
    cache.clear()
    yield
    cache.clear()


# --- parse_ref: the only thing between a crafted link and a GROUP BY ---------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("job:123", ("job", "job:123")),
        ("JOB:123", ("job", "job:123")),  # case folded
        ("uni:ist", ("uni", "uni:ist")),
        ("meetup:2026-11-04", ("meetup", "meetup:2026-11-04")),
        ("linkedin", ("linkedin", "linkedin")),
        # Unknown head: kept in full for reading, grouped as "other" so one
        # unplanned channel can't fragment the funnel into buckets of one.
        ("bogus:x", ("other", "bogus:x")),
        # Unusable detail, recognisable source: "a job page sent this person"
        # is still worth keeping.
        ("job:<script>alert(1)</script>", ("job", "job")),
        ("", ("", "")),
        (None, ("", "")),
        ("../etc/passwd", ("", "")),
        ("a" * 200, ("", "")),
    ],
)
def test_parse_ref(raw, expected):
    assert parse_ref(raw) == expected


def test_parsed_source_is_always_groupable():
    """Whatever arrives, `source` is either a known channel or "other"."""
    from accounts.signup_source import KNOWN_SOURCES

    for raw in ["job:1", "weird", "x" * 25, "a:b:c", "UNI:IST", "drop table users"]:
        source, _ = parse_ref(raw)
        assert source == "" or source in KNOWN_SOURCES or source == "other"


# --- stash / claim ----------------------------------------------------------


@pytest.mark.django_db
def test_stash_then_claim_consumes_once():
    stash_ref("ada@example.com", "job:42")
    assert claim_ref("ada@example.com") == {"source": "job", "ref": "job:42"}
    # Consumed: one parked ref marks one account, never two.
    assert claim_ref("ada@example.com") is None


@pytest.mark.django_db
def test_stash_ignores_unparseable_ref():
    stash_ref("ada@example.com", "../etc/passwd")
    assert claim_ref("ada@example.com") is None


@pytest.mark.django_db
def test_last_submission_wins():
    """Ask from a job page, abandon, ask again from the co-founder page: the
    link they will actually click is the second one."""
    stash_ref("ada@example.com", "job:42")
    stash_ref("ada@example.com", "cofounder")
    assert claim_ref("ada@example.com")["source"] == "cofounder"


# --- provisioning -----------------------------------------------------------


def _claims(uid, email):
    return {"uid": uid, "email": email, "email_verified": True}


@pytest.mark.django_db
def test_new_user_records_the_origin():
    stash_ref("ada@example.com", "job:42")
    user = get_or_provision_firebase_user(_claims("fb-ada", "ada@example.com"))
    assert (user.signup_source, user.signup_ref) == ("job", "job:42")


@pytest.mark.django_db
def test_origin_is_written_once_and_never_rewritten():
    stash_ref("ada@example.com", "job:42")
    get_or_provision_firebase_user(_claims("fb-ada", "ada@example.com"))

    # A later sign-in from a shared co-founder link must not rewrite history.
    stash_ref("ada@example.com", "cofounder")
    user = get_or_provision_firebase_user(_claims("fb-ada", "ada@example.com"))
    assert (user.signup_source, user.signup_ref) == ("job", "job:42")


@pytest.mark.django_db
def test_pre_cutover_account_is_not_attributed():
    """Adopting an Entra-era row is a returning user, not an acquisition —
    stamping a ref on it would inflate whichever channel they came through."""
    existing = User.objects.create_user(
        username="ada", email="ada@example.com", password="x"
    )
    existing.email_verified_at = timezone.now()
    existing.save(update_fields=["email_verified_at"])

    stash_ref("ada@example.com", "job:42")
    user = get_or_provision_firebase_user(_claims("fb-ada", "ada@example.com"))

    assert user.pk == existing.pk
    assert user.signup_source == ""


@pytest.mark.django_db
def test_no_ref_is_not_an_error():
    user = get_or_provision_firebase_user(_claims("fb-bob", "bob@example.com"))
    assert (user.signup_source, user.signup_ref) == ("", "")


# --- the funnel -------------------------------------------------------------


def _person(email, *, source="", ref="", complete=False, active_after_days=None):
    user = User.objects.create_user(username=email.split("@")[0], email=email, password="x")
    user.signup_source = source
    user.signup_ref = ref
    user.save()
    if active_after_days is not None:
        UserActiveDay.objects.create(
            user=user, day=local_day(user.date_joined) + timezone.timedelta(days=active_after_days)
        )
    fields = (
        {
            "full_name": "Ada Lovelace",
            "headline": "Builder",
            "country": "PT",
            "city": "Lisboa",
            "bio": "Two or three lines.",
            "skills": ["python"],
        }
        if complete
        else {}
    )
    InvestorProfile.objects.create(user=user, **fields)
    return user


@pytest.mark.django_db
def test_funnel_groups_by_origin_and_names_the_unknown_bucket():
    _person("a@example.com", source="job", ref="job:1")
    _person("b@example.com", source="job", ref="job:2")
    _person("c@example.com")  # nobody told us

    funnel = acquisition_funnel()
    labels = {row["label"]: row["registered"] for row in funnel["rows"]}

    assert labels["job"] == 2
    # Named, not hidden: it is normally the biggest bucket, and hiding it makes
    # every measured channel look bigger than it is.
    assert labels["direct/unknown"] == 1
    assert funnel["total"]["registered"] == 3


@pytest.mark.django_db
def test_activation_needs_profile_and_a_connection_not_either():
    """§0: "registo + perfil ≥ 60% + pelo menos uma ligação". All three."""
    org = Organization.objects.create(name="WaveRent", slug="waverent")

    profile_only = _person("p@example.com", source="job", complete=True)
    connection_only = _person("c@example.com", source="job")
    OrgFollow.objects.create(org=org, user=connection_only)
    both = _person("b@example.com", source="job", complete=True)
    OrgFollow.objects.create(org=org, user=both)

    row = next(r for r in acquisition_funnel()["rows"] if r["label"] == "job")

    assert row["registered"] == 3
    assert row["with_profile"] == 2  # profile_only, both
    assert row["with_connection"] == 2  # connection_only, both
    assert row["activated"] == 1  # only `both`
    assert profile_only.id and connection_only.id  # kept for readability


@pytest.mark.django_db
def test_top_refs_show_the_detail_half():
    _person("a@example.com", source="job", ref="job:7")
    _person("b@example.com", source="job", ref="job:7")
    _person("c@example.com", source="uni", ref="uni:ist")
    # A ref identical to its source adds nothing to read.
    _person("d@example.com", source="linkedin", ref="linkedin")

    refs = {r["ref"]: r["count"] for r in acquisition_funnel()["top_refs"]}
    assert refs == {"job:7": 2, "uni:ist": 1}


@pytest.mark.django_db
def test_returned_within_7_days_is_a_window_not_a_floor():
    _person("same@example.com", source="job", active_after_days=0)  # same day
    _person("week@example.com", source="job", active_after_days=3)  # came back
    _person("late@example.com", source="job", active_after_days=20)  # too late

    row = next(r for r in acquisition_funnel()["rows"] if r["label"] == "job")
    assert row["returned"] == 1


@pytest.mark.django_db
def test_returning_later_does_not_erase_a_first_week_return():
    """The old last_login proxy forgot anyone who kept coming back."""
    user = _person("loyal@example.com", source="job", active_after_days=2)
    UserActiveDay.objects.create(
        user=user, day=local_day(user.date_joined) + timezone.timedelta(days=25)
    )
    row = next(r for r in acquisition_funnel()["rows"] if r["label"] == "job")
    assert row["returned"] == 1


@pytest.mark.django_db
def test_internal_and_staff_accounts_are_not_a_channel():
    _person("real@example.com", source="job")
    tester = _person("tester@example.com", source="job")
    tester.is_internal = True
    tester.save()
    User.objects.create_user(username="staff", email="s@example.com", password="x", is_staff=True)

    assert acquisition_funnel()["total"]["registered"] == 1


@pytest.mark.django_db
def test_empty_window_does_not_divide_by_zero():
    funnel = acquisition_funnel()
    assert funnel["rows"] == []
    assert funnel["total"]["registered"] == 0
    assert funnel["total"]["with_profile_pct"] is None
