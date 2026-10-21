import io
import os
import zipfile
from datetime import date
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import Throttled
from rest_framework.test import APIClient

from accounts import linkedin_views
from accounts.linkedin_import import (
    MAX_UPLOAD_BYTES,
    OVERSIZE_MESSAGE,
    LinkedInImportError,
    parse_linkedin_date,
    parse_linkedin_export,
)
from accounts.models import InvestorProfile, SelfDeclaredExperience, User
from accounts.timeline import person_timeline
from orgs.models import Organization

# The rate-limit cache is database-backed, so every test here needs the DB.
pytestmark = pytest.mark.django_db

# Column layouts as LinkedIn's "Get a copy of your data" writes them.
PROFILE_CSV = (
    "First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location\n"
    'Ana,Silva,,,,"Founder at Acme | Fintech","I build payment tools.\n\nPreviously at Northwind.",'
    'Financial Services,,"Lisbon, Portugal"\n'
)
POSITIONS_CSV = (
    "Company Name,Title,Description,Location,Started On,Finished On\n"
    'Acme,Founder & CEO,"Started it, still here.","Lisbon, Portugal",Mar 2023,\n'
    "Northwind,Product Manager,,Remote,Jun 2019,Feb 2023\n"
    "Mystery Co,Advisor,,,,\n"
)
EDUCATION_CSV = (
    "School Name,Start Date,End Date,Notes,Degree Name,Activities\n"
    "Nova SBE,2014,2018,,MSc Management,\n"
    "Coursera,2024,2099,,Data Science,\n"
    "Old School,1940,1944,,,\n"
)
SKILLS_CSV = "Name\nProduct Management\nFintech\nfintech\nPython\n"
CONNECTIONS_CSV = (
    "Notes:\n"
    '"When exporting your connection data, you may notice that some of the email addresses are missing."\n'
    "\n"
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n"
    "Rui,Costa,https://www.linkedin.com/in/rui,rui@example.com,Globex,CTO,05 Sep 2023\n"
)


def _zip(files: dict[str, str], name="Basic_LinkedInDataExport_10-19-2026.zip") -> SimpleUploadedFile:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="application/zip")


def _full_export(**overrides):
    files = {
        "Profile.csv": PROFILE_CSV,
        "Positions.csv": POSITIONS_CSV,
        "Education.csv": EDUCATION_CSV,
        "Skills.csv": SKILLS_CSV,
        "Connections.csv": CONNECTIONS_CSV,
        "messages.csv": "CONVERSATION ID,FROM,TO,CONTENT\n1,Rui,Ana,private stuff\n",
    }
    files.update(overrides)
    return _zip(files)


def _padded_export(padding: bytes) -> SimpleUploadedFile:
    """A real export plus one big member we never read — stored, not
    deflated, so the upload is genuinely as large as `padding`."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Profile.csv", PROFILE_CSV)
        zf.writestr("Positions.csv", POSITIONS_CSV)
        zf.writestr(zipfile.ZipInfo("Media/photo.bin"), padding)
    return SimpleUploadedFile(
        "Basic_LinkedInDataExport_10-19-2026.zip", buf.getvalue(), content_type="application/zip"
    )


# ---------------------------------------------------------------- parser


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Mar 2021", date(2021, 3, 1)),
        ("05 Sep 2023", date(2023, 9, 5)),
        ("2014", date(2014, 1, 1)),
        ("2021-03", date(2021, 3, 1)),
        ("03/2021", date(2021, 3, 1)),
        ("mar. de 2021", date(2021, 3, 1)),
        ("set 2020", date(2020, 9, 1)),
        ("dic 2019", date(2019, 12, 1)),
        ("Sept 2018", date(2018, 9, 1)),
        ("", None),
        ("Present", None),
        ("someday", None),
    ],
)
def test_parse_linkedin_date(raw, expected):
    assert parse_linkedin_date(raw) == expected


def test_parses_profile_positions_education_and_skills():
    parsed = parse_linkedin_export([_full_export()])

    assert parsed.full_name == "Ana Silva"
    assert parsed.headline == "Founder at Acme | Fintech"
    assert parsed.summary == "I build payment tools.\n\nPreviously at Northwind."
    assert parsed.location == "Lisbon, Portugal"
    assert [(p.org_name, p.role, p.started_on, p.ended_on) for p in parsed.positions] == [
        ("Acme", "Founder & CEO", date(2023, 3, 1), None),
        ("Northwind", "Product Manager", date(2019, 6, 1), date(2023, 2, 1)),
        ("Mystery Co", "Advisor", None, None),
    ]
    assert [(e.org_name, e.role, e.kind) for e in parsed.education] == [
        ("Nova SBE", "MSc Management", "education"),
        ("Coursera", "Data Science", "education"),
        ("Old School", "", "education"),
    ]
    assert parsed.skills == ["Product Management", "Fintech", "Python"]


def test_never_opens_connections_or_messages():
    upload = _full_export()  # built before the spy, which would see the writes
    opened = []
    real_open = zipfile.ZipFile.open

    def spy(self, name, *args, **kwargs):
        opened.append(getattr(name, "filename", name))
        return real_open(self, name, *args, **kwargs)

    with patch.object(zipfile.ZipFile, "open", spy):
        parsed = parse_linkedin_export([upload])

    assert sorted(opened) == ["Education.csv", "Positions.csv", "Profile.csv", "Skills.csv"]
    assert parsed.files_read == ["education.csv", "positions.csv", "profile.csv", "skills.csv"]


def test_loose_csvs_work_when_the_zip_was_unzipped():
    files = [
        SimpleUploadedFile("Positions.csv", POSITIONS_CSV.encode()),
        SimpleUploadedFile("Skills.csv", ("﻿" + SKILLS_CSV).encode()),  # BOM
        SimpleUploadedFile("Connections.csv", CONNECTIONS_CSV.encode()),
    ]
    parsed = parse_linkedin_export(files)
    assert len(parsed.positions) == 3
    assert parsed.skills[0] == "Product Management"
    assert parsed.files_read == ["positions.csv", "skills.csv"]


def test_header_matching_is_case_insensitive_and_files_may_be_nested():
    upload = _zip({"export/positions.CSV": "company name,TITLE,started on,finished on\nAcme,CEO,Jan 2020,\n"})
    parsed = parse_linkedin_export([upload])
    assert parsed.positions[0].org_name == "Acme"


def test_preamble_before_the_header_is_skipped():
    csv_with_preamble = "Notes:\n\"Some explanation, with a comma.\"\n\n" + POSITIONS_CSV
    parsed = parse_linkedin_export([_zip({"Positions.csv": csv_with_preamble})])
    assert len(parsed.positions) == 3


@pytest.mark.parametrize(
    "upload,message",
    [
        (SimpleUploadedFile("export.zip", b"not a zip at all"), "valid ZIP"),
        (_zip({"Connections.csv": CONNECTIONS_CSV}), "couldn't find your profile"),
        (SimpleUploadedFile("cv.pdf", b"%PDF-1.7"), "couldn't find your profile"),
    ],
)
def test_friendly_errors(upload, message):
    with pytest.raises(LinkedInImportError, match=message):
        parse_linkedin_export([upload])


def test_oversized_member_is_refused_before_decompressing():
    # ~3 MB of text compresses to a few KB: the classic zip-bomb shape.
    bomb = _zip({"Positions.csv": "Company Name,Title\n" + "A,B\n" * 800_000})
    assert bomb.size < 100_000
    with pytest.raises(LinkedInImportError, match="larger than expected"):
        parse_linkedin_export([bomb])


def test_oversized_upload_is_refused():
    big = SimpleUploadedFile("export.zip", b"0" * (5 * 1024 * 1024 + 1))
    with pytest.raises(LinkedInImportError, match="too large"):
        parse_linkedin_export([big])


# ---------------------------------------------------------------- API


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def ana(db):
    return User.objects.create_user(username="ana", email="ana@example.com", password="x")


@pytest.fixture
def api(ana):
    client = APIClient()
    client.force_authenticate(ana)
    return client


def _preview(api, *uploads):
    return api.post(
        "/api/profile/import/linkedin/preview/", {"files": list(uploads)}, format="multipart"
    )


@pytest.mark.django_db
def test_preview_returns_review_data_and_writes_nothing(api, ana):
    InvestorProfile.objects.create(user=ana, headline="Builder", skills=["python"])
    SelfDeclaredExperience.objects.create(
        user=ana, org_name="NORTHWIND", role="PM", started_on=date(2019, 6, 1)
    )
    Organization.objects.create(slug="acme", name="ACME", status=Organization.Status.LIVE)

    res = _preview(api, _full_export())

    assert res.status_code == 200
    body = res.json()
    assert body["profile"]["headline"] == {"imported": "Founder at Acme | Fintech", "current": "Builder"}
    assert body["profile"]["full_name"]["imported"] == "Ana Silva"
    assert body["profile"]["location"] == {"imported": "Lisbon, Portugal", "current_country": ""}
    # Already-held skills (case-insensitive) aren't offered again.
    assert body["skills"]["imported"] == ["Product Management", "Fintech"]
    by_org = {e["org_name"]: e for e in body["entries"]}
    assert by_org["Acme"]["status"] == "new"
    assert by_org["Acme"]["beedero_org"] == {"slug": "acme", "name": "ACME"}
    assert by_org["Northwind"]["status"] == "already_on_profile"
    assert by_org["Mystery Co"]["status"] == "missing_start"
    assert by_org["Nova SBE"]["kind"] == "education"
    assert by_org["Nova SBE"]["beedero_org"] is None
    # An expected end date (still studying) is just "ongoing"…
    assert by_org["Coursera"]["ended_on"] is None
    assert by_org["Coursera"]["status"] == "new"
    # …and dates the experience form would refuse are flagged, not sent.
    assert by_org["Old School"]["status"] == "invalid_dates"
    # Preview is read-only.
    assert SelfDeclaredExperience.objects.filter(user=ana).count() == 1
    assert InvestorProfile.objects.get(user=ana).headline == "Builder"


@pytest.fixture
def uploads_seen(monkeypatch):
    """Every upload the view's handler built, so a test can check it was
    closed whichever way the request ended."""
    seen = []
    real = linkedin_views._MemoryOnlyUploadHandler.file_complete

    def spy(self, file_size):
        upload = real(self, file_size)
        if upload is not None:
            seen.append(upload)
        return upload

    monkeypatch.setattr(linkedin_views._MemoryOnlyUploadHandler, "file_complete", spy)
    return seen


@pytest.mark.django_db
def test_upload_is_freed_even_when_the_import_fails(api, uploads_seen):
    """"Purged when the import finishes" has to mean every ending, not just
    the happy one."""
    res = _preview(api, SimpleUploadedFile("export.zip", b"nope", content_type="application/zip"))
    assert res.status_code == 400
    assert len(uploads_seen) == 1
    assert uploads_seen[0].closed


@pytest.mark.django_db
def test_rate_limited_request_leaves_no_live_upload(api, uploads_seen):
    """Throttled fires before the view touches request.FILES, so the body is
    never even parsed and there is nothing to free. Pinned because the thing
    that matters is the same either way: no buffer outlives the request."""
    with patch.object(
        linkedin_views, "enforce_rate_limit", side_effect=Throttled(detail="Too many requests.")
    ):
        res = _preview(api, _full_export())
    assert res.status_code == 429
    assert all(upload.closed for upload in uploads_seen)


@pytest.mark.django_db
def test_upload_is_freed_when_the_view_blows_up(api, uploads_seen):
    # A bug, not a handled error: the export still goes with the request.
    with patch.object(linkedin_views, "parse_linkedin_export", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            _preview(api, _full_export())
    assert len(uploads_seen) == 1
    assert uploads_seen[0].closed


@pytest.mark.django_db
def test_upload_is_never_written_to_disk_and_is_freed_before_responding(api, settings):
    """The panel tells people the file isn't stored. Django would spool
    anything over FILE_UPLOAD_MAX_MEMORY_SIZE into a temp file, so this pins
    the memory-only handler and the explicit close."""
    upload = _padded_export(os.urandom(3 * 1024 * 1024))
    assert upload.size > settings.FILE_UPLOAD_MAX_MEMORY_SIZE

    seen = {}
    real = linkedin_views.parse_linkedin_export

    def spy(uploads):
        seen["type"] = type(uploads[0]).__name__
        seen["on_disk"] = hasattr(uploads[0], "temporary_file_path")
        seen["closed_during"] = uploads[0].closed
        result = real(uploads)
        seen["uploads"] = uploads
        return result

    with patch.object(linkedin_views, "parse_linkedin_export", spy):
        res = _preview(api, upload)

    assert res.status_code == 200
    assert seen["type"] == "InMemoryUploadedFile"
    assert seen["on_disk"] is False
    assert seen["closed_during"] is False
    # …and closed by the time the response goes out.
    assert all(f.closed for f in seen["uploads"])


@pytest.mark.django_db
def test_body_over_the_cap_is_refused_with_the_oversize_message(api):
    # Too big for the memory-only handler, which leaves request.FILES empty.
    big = SimpleUploadedFile("export.zip", b"0" * (MAX_UPLOAD_BYTES + 1), content_type="application/zip")
    res = _preview(api, big)
    assert res.status_code == 400
    assert res.json()["detail"] == OVERSIZE_MESSAGE


@pytest.mark.django_db
def test_preview_error_is_a_400_with_a_readable_message(api):
    res = _preview(api, SimpleUploadedFile("export.zip", b"nope"))
    assert res.status_code == 400
    assert "ZIP" in res.json()["detail"]


@pytest.mark.django_db
def test_import_requires_sign_in():
    res = APIClient().post("/api/profile/import/linkedin/preview/", {}, format="multipart")
    assert res.status_code == 401


def _apply(api, **payload):
    return api.post("/api/profile/import/linkedin/apply/", payload, format="json")


ENTRIES = [
    {"kind": "work", "org_name": "Acme", "role": "Founder & CEO", "started_on": "2023-03-01", "ended_on": None},
    {"kind": "education", "org_name": "Nova SBE", "role": "MSc Management", "started_on": "2014-01-01", "ended_on": "2018-01-01"},
]


@pytest.mark.django_db
def test_apply_saves_only_what_was_sent_and_is_idempotent(api, ana):
    res = _apply(
        api,
        full_name="Ana Silva",
        headline="Founder at Acme | Fintech",
        bio="I build payment tools.",
        country="PT",
        skills=["Fintech", "Python"],
        entries=ENTRIES,
    )
    assert res.status_code == 200, res.content
    assert res.json() == {
        "profile_fields_updated": ["bio", "country", "full_name", "headline"],
        "skills_added": 2,
        "entries_created": 2,
        "entries_skipped": 0,
    }
    profile = InvestorProfile.objects.get(user=ana)
    assert profile.full_name == "Ana Silva"
    assert profile.country == "PT"
    assert profile.is_complete
    assert profile.handle  # a public handle is assigned like any profile save
    assert list(
        SelfDeclaredExperience.objects.filter(user=ana).order_by("started_on").values_list("kind", "org_name")
    ) == [("education", "Nova SBE"), ("work", "Acme")]

    again = _apply(api, entries=ENTRIES)
    assert again.json()["entries_created"] == 0
    assert again.json()["entries_skipped"] == 2


@pytest.mark.django_db
def test_apply_never_overwrites_a_name_and_keeps_existing_skills_first(api, ana):
    existing = [f"skill {i}" for i in range(29)]
    InvestorProfile.objects.create(user=ana, full_name="Ana S.", skills=existing)

    res = _apply(api, full_name="Someone Else", skills=["New A", "New B", "New C"])

    assert res.status_code == 200
    profile = InvestorProfile.objects.get(user=ana)
    assert profile.full_name == "Ana S."
    assert profile.skills == existing + ["New A"]  # cap of 30 trims imported ones only
    assert res.json()["skills_added"] == 1


@pytest.mark.django_db
def test_apply_rejects_impossible_dates_atomically(api, ana):
    bad = [*ENTRIES, {"kind": "work", "org_name": "X", "started_on": "2020-01-01", "ended_on": "2019-01-01"}]
    res = _apply(api, headline="New", entries=bad)
    assert res.status_code == 400
    assert not SelfDeclaredExperience.objects.filter(user=ana).exists()
    assert not InvestorProfile.objects.filter(user=ana, headline="New").exists()


@pytest.mark.django_db
def test_imported_education_shows_on_the_timeline_as_self_declared(api, ana):
    _apply(api, full_name="Ana Silva", entries=ENTRIES)
    profile = InvestorProfile.objects.get(user=ana)
    bands = {b["org_name"]: b for b in person_timeline(profile, ana)}
    assert bands["Nova SBE"]["kind"] == "education"
    assert bands["Nova SBE"]["verified"] is False
    assert bands["Acme"]["kind"] == "work"
