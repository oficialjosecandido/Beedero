"""Open roles, visible without an account — doc §3.

The tests worth having here are the ones about the boundary: that nothing
closed, expired or belonging to a draft org is reachable, that no applicant
data can leak out of a public endpoint, and that the pagination doesn't repeat
or skip rows while people keep posting jobs.
"""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs.models import Organization, OrgMembership

from .models import Application, EngagementType, JobPost
from .services import apply_to_job, close_job, create_job
from billing.testing import grant_plan


@pytest.fixture(autouse=True)
def _clear_cache():
    # The throttle and the rate limits both live in the cache; a full table
    # from a previous test would make these pass or fail for the wrong reason.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", email="owner@acme.com", password="x")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    grant_plan(org)
    return org


@pytest.fixture
def draft_org(db, owner):
    org = Organization.objects.create(
        slug="draftco", name="DraftCo", status=Organization.Status.DRAFT
    )
    OrgMembership.objects.create(org=org, user=owner, role=OrgMembership.Role.OWNER)
    return org


def _rows(org, count, **overrides):
    """`count` open jobs, written straight to the table.

    Not `create_job`, which enforces the 10-a-day posting limit — a limit worth
    having and worth not fighting with. Pagination is about rows, and these
    tests need more rows than a real org may post in a day.
    """
    fields = dict(
        description="Build the thing.",
        engagement_type=EngagementType.FULL_TIME,
        location_type=JobPost.LocationType.REMOTE,
        status=JobPost.Status.OPEN,
        expires_at=timezone.now() + timedelta(days=7),
    )
    fields.update(overrides)
    return [
        JobPost.objects.create(org=org, title=f"Role {index}", **fields) for index in range(count)
    ]


def _job(org, **overrides):
    fields = dict(
        title="Founding engineer",
        description="Build the thing.",
        engagement_type=EngagementType.FULL_TIME,
        location_type=JobPost.LocationType.REMOTE,
        compensation_kinds=[],
    )
    fields.update(overrides)
    return create_job(org, created_by=None, **fields)


# --- what is reachable -----------------------------------------------------


@pytest.mark.django_db
def test_an_open_job_is_readable_without_an_account(api, org):
    job = _job(org)
    res = api.get("/api/public/jobs/")
    assert res.status_code == 200
    body = res.json()
    assert [item["id"] for item in body["items"]] == [job.id]
    assert body["items"][0]["org"]["name"] == "Acme"
    assert body["next_cursor"] is None

    detail = api.get(f"/api/public/jobs/{job.id}/")
    assert detail.status_code == 200
    assert detail.json()["title"] == "Founding engineer"


@pytest.mark.django_db
def test_a_closed_job_is_gone_from_both(api, org):
    job = _job(org)
    close_job(job)
    assert api.get("/api/public/jobs/").json()["items"] == []
    assert api.get(f"/api/public/jobs/{job.id}/").status_code == 404


@pytest.mark.django_db
def test_an_expired_job_404s_rather_than_rendering_as_closed(api, org):
    """§3.3 allows a "closed" page; 404 is the one Google can't keep indexing."""
    job = _job(org)
    JobPost.objects.filter(pk=job.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
    assert api.get("/api/public/jobs/").json()["items"] == []
    assert api.get(f"/api/public/jobs/{job.id}/").status_code == 404


@pytest.mark.django_db
def test_a_draft_orgs_job_is_not_public(api, draft_org):
    """A job can only exist on a LIVE org, so this one is forced into place —
    the filter has to hold even if an org is taken off LIVE later."""
    job = JobPost.objects.create(
        org=draft_org,
        title="Ghost role",
        description="x",
        engagement_type=EngagementType.FULL_TIME,
        location_type=JobPost.LocationType.REMOTE,
        status=JobPost.Status.OPEN,
        expires_at=timezone.now() + timedelta(days=7),
    )
    assert api.get("/api/public/jobs/").json()["items"] == []
    assert api.get(f"/api/public/jobs/{job.id}/").status_code == 404


# --- what is not in the payload --------------------------------------------


@pytest.mark.django_db
def test_no_applicant_data_reaches_a_public_endpoint(api, org):
    """§3.1: "**Nunca** candidaturas nem dados de candidatos.\""""
    job = _job(org)
    applicant = User.objects.create_user(
        username="ada", email="ada@example.com", password="x"
    )
    InvestorProfile.objects.create(user=applicant, full_name="Ada Lovelace", handle="ada")
    apply_to_job(job, applicant, note="I'd like this job.")
    assert Application.objects.count() == 1

    for payload in (
        api.get("/api/public/jobs/").content.decode(),
        api.get(f"/api/public/jobs/{job.id}/").content.decode(),
    ):
        assert "Ada" not in payload
        assert "ada@example.com" not in payload
        assert "application" not in payload.lower()


@pytest.mark.django_db
def test_the_public_payload_carries_no_lifecycle_fields(api, org):
    """`status` and `renewal_count` answer an org's question, not a reader's."""
    job = _job(org)
    item = api.get(f"/api/public/jobs/{job.id}/").json()
    assert "status" not in item
    assert "renewal_count" not in item
    assert set(item["org"]) == {
        "slug",
        "name",
        "one_liner",
        "logo",
        "is_verified",
        "credibility_level",
    }


# --- filters ---------------------------------------------------------------


@pytest.mark.django_db
def test_filters_by_engagement_and_location(api, org):
    remote = _job(org, title="Remote role")
    onsite = _job(
        org,
        title="Office role",
        engagement_type=EngagementType.INTERNSHIP,
        location_type=JobPost.LocationType.ONSITE,
        location_city="Lisboa",
    )

    by_type = api.get("/api/public/jobs/?type=internship").json()["items"]
    assert [item["id"] for item in by_type] == [onsite.id]

    by_location = api.get("/api/public/jobs/?location=remote").json()["items"]
    assert [item["id"] for item in by_location] == [remote.id]


@pytest.mark.django_db
def test_a_city_filter_keeps_the_remote_jobs(api, org):
    """Someone filtering for Lisbon can still take a remote job in Lisbon."""
    remote = _job(org, title="Remote role")
    lisbon = _job(org, title="Lisbon role", location_type=JobPost.LocationType.ONSITE, location_city="Lisboa")
    _job(org, title="Porto role", location_type=JobPost.LocationType.ONSITE, location_city="Porto")

    items = api.get("/api/public/jobs/?city=lisboa").json()["items"]
    assert {item["id"] for item in items} == {remote.id, lisbon.id}


@pytest.mark.django_db
def test_an_unknown_filter_value_returns_nothing_not_everything(api, org):
    _job(org)
    assert api.get("/api/public/jobs/?type=wizard").json()["items"] == []
    assert api.get("/api/public/jobs/?location=moon").json()["items"] == []


# --- pagination ------------------------------------------------------------


@pytest.mark.django_db
def test_keyset_pagination_walks_every_job_once(api, org):
    jobs = _rows(org, 25)

    first = api.get("/api/public/jobs/").json()
    assert len(first["items"]) == 20
    assert first["next_cursor"]

    second = api.get(f"/api/public/jobs/?cursor={first['next_cursor']}").json()
    assert len(second["items"]) == 5
    assert second["next_cursor"] is None

    seen = [item["id"] for item in first["items"] + second["items"]]
    assert len(set(seen)) == 25
    assert set(seen) == {job.id for job in jobs}


@pytest.mark.django_db
def test_a_job_posted_mid_walk_cannot_push_a_row_into_a_second_page(api, org):
    """The reason it is keyset and not offset: with `?offset=20`, inserting a
    newer row shifts everything down and page two repeats the last of page one."""
    _rows(org, 21)
    first = api.get("/api/public/jobs/").json()
    last_of_first_page = first["items"][-1]["id"]

    _job(org, title="Posted while you were reading")

    second = api.get(f"/api/public/jobs/?cursor={first['next_cursor']}").json()
    assert last_of_first_page not in [item["id"] for item in second["items"]]


@pytest.mark.django_db
def test_a_mangled_cursor_is_page_one_not_an_error(api, org):
    """These URLs get pasted into chat apps, which truncate them."""
    _job(org)
    res = api.get("/api/public/jobs/?cursor=not-a-cursor")
    assert res.status_code == 200
    assert len(res.json()["items"]) == 1


# --- the sitemap -----------------------------------------------------------


@pytest.mark.django_db
def test_open_jobs_are_in_the_public_sitemap(api, org, draft_org):
    job = _job(org)
    closed = _job(org, title="Filled already")
    close_job(closed)

    entries = api.get("/api/public/sitemap/").json()["jobs"]
    assert [entry["id"] for entry in entries] == [job.id]
    assert entries[0]["lastmod"] == job.created_at.date().isoformat()


# --- applying with the minimum profile (§3.5) ------------------------------


@pytest.mark.django_db
def test_applying_can_fill_the_minimum_profile_in_the_same_submit(api, org):
    """The person arrived from a public job page and has no profile at all."""
    job = _job(org)
    applicant = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    api.force_authenticate(applicant)

    res = api.post(
        f"/api/jobs/{job.id}/apply/",
        {
            "note": "Here's why I'd be good at this.",
            "external_link": "https://ada.example.com",
            "profile": {"full_name": "Ada Lovelace", "headline": "Engineer", "city": "Lisboa"},
        },
        format="json",
    )
    assert res.status_code == 201
    # The org's list of applicants shows a name, not an email local part.
    assert res.json()["applicant"]["name"] == "Ada Lovelace"

    profile = InvestorProfile.objects.get(user=applicant)
    assert profile.full_name == "Ada Lovelace"
    assert profile.headline == "Engineer"
    assert profile.city == "Lisboa"
    # Derived in InvestorProfile.save(), so the city is countable straight
    # away — and canonicalised, which is why "Lisboa" keys as "lisbon"
    # (accounts/cities.py folds the two spellings into one city).
    assert profile.city_key == "lisbon"


@pytest.mark.django_db
def test_applying_never_overwrites_a_profile_someone_already_wrote(api, org):
    job = _job(org)
    applicant = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    InvestorProfile.objects.create(
        user=applicant, full_name="Ada Lovelace", headline="Mathematician", city="Porto"
    )
    api.force_authenticate(applicant)

    res = api.post(
        f"/api/jobs/{job.id}/apply/",
        {"note": "hi", "profile": {"full_name": "A. L.", "headline": "Intern", "city": "Lisboa"}},
        format="json",
    )
    assert res.status_code == 201

    profile = InvestorProfile.objects.get(user=applicant)
    assert (profile.full_name, profile.headline, profile.city) == (
        "Ada Lovelace",
        "Mathematician",
        "Porto",
    )


@pytest.mark.django_db
def test_an_application_without_a_profile_block_still_works(api, org):
    """Everyone who already has a profile posts the body as it was before."""
    job = _job(org)
    applicant = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    api.force_authenticate(applicant)
    res = api.post(f"/api/jobs/{job.id}/apply/", {"note": "hi"}, format="json")
    assert res.status_code == 201
    assert Application.objects.filter(job=job, applicant=applicant).exists()
