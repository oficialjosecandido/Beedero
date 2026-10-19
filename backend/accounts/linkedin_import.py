"""Read a person's own LinkedIn data export ("Get a copy of your data").

Why the export and not the LinkedIn API: Sign In with LinkedIn (OpenID
Connect) only returns name, email and photo. Positions, education and skills
are reserved for LinkedIn's partner programs, and scraping profiles breaks
LinkedIn's terms. The export is the person exercising their own right to a
copy of their data (GDPR art. 20) and handing it to us — structured CSV, in
full, no guessing at a PDF layout.

Rules this module keeps:

* Only the four files that describe the person's own profile are ever
  opened: Profile, Positions, Education, Skills. Connections, messages,
  invitations and everything else in the archive are other people's data or
  irrelevant here; they are skipped by name, never read.
* Nothing is stored. The upload is parsed in memory, the parsed result goes
  back to the person for review, and only what they confirm is saved (by the
  apply endpoint, through the normal serializers).
* Untrusted input: archive size, entry count, per-file size and row counts
  are all capped before anything is decompressed or parsed.
* Tolerant: file and column names match case-insensitively, any file may be
  missing, unknown columns are ignored, and a prose preamble before the
  header row (LinkedIn adds one to some files) is skipped.
"""

import csv
import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ZIP_ENTRIES = 2000
MAX_FILE_BYTES = 2 * 1024 * 1024  # uncompressed, per CSV we actually read
MAX_POSITIONS = 100
MAX_EDUCATION = 50
MAX_SKILLS_READ = 200
MAX_SUMMARY = 2600  # LinkedIn's own "About" limit
MAX_HEADLINE = 200
MAX_NAME = 200
MAX_ORG_NAME = 200
MAX_ROLE = 120

# basename (lowercase) -> the header columns that identify the real header row
WANTED_FILES = {
    "profile.csv": {"first name", "last name"},
    "positions.csv": {"company name", "title"},
    "education.csv": {"school name"},
    "skills.csv": {"name"},
}


class LinkedInImportError(ValueError):
    """A problem worth showing to the person as-is."""


@dataclass
class ParsedEntry:
    org_name: str
    role: str
    started_on: date | None
    ended_on: date | None
    kind: str  # "work" | "education"


@dataclass
class ParsedExport:
    full_name: str = ""
    headline: str = ""
    summary: str = ""
    location: str = ""  # free text, e.g. "Lisbon, Portugal" — the client maps it to a country
    positions: list[ParsedEntry] = field(default_factory=list)
    education: list[ParsedEntry] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    files_read: list[str] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not (
            self.full_name or self.headline or self.summary
            or self.positions or self.education or self.skills
        )


# ---------------------------------------------------------------- dates

_MONTHS = {
    # English
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
    # Portuguese
    "fev": 2, "abr": 4, "mai": 5, "ago": 8, "set": 9, "out": 10, "dez": 12,
    # Spanish
    "ene": 1, "dic": 12,
}
_ONGOING = {"", "present", "presente", "actualidad", "atual", "now", "current"}


def parse_linkedin_date(raw: str) -> date | None:
    """'Mar 2021', 'mar. de 2021', '05 Sep 2023', '2021', '2021-03',
    '03/2021' -> date (day 1 when only month/year are known). Empty or
    'Present' -> None. Anything else unreadable -> None."""
    value = (raw or "").strip().lower()
    if value in _ONGOING:
        return None

    m = re.fullmatch(r"(\d{4})-(\d{1,2})(?:-(\d{1,2}))?", value)
    if m:
        return _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3) or 1))
    m = re.fullmatch(r"(\d{1,2})/(\d{4})", value)
    if m:
        return _safe_date(int(m.group(2)), int(m.group(1)), 1)

    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", value)
    if not year_match:
        return None
    year = int(year_match.group(1))
    month, day = 1, 1
    for token in re.findall(r"[a-zà-ú]+", value):
        if token[:4] in _MONTHS:
            month = _MONTHS[token[:4]]
            break
        if token[:3] in _MONTHS:
            month = _MONTHS[token[:3]]
            break
    day_match = re.match(r"(\d{1,2})\s", value)
    if day_match:
        day = int(day_match.group(1))
    return _safe_date(year, month, day)


def _safe_date(year, month, day):
    try:
        return date(year, month, day)
    except ValueError:
        try:
            return date(year, month, 1)
        except ValueError:
            return None


# ---------------------------------------------------------------- CSV

def _decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _rows(text: str, required: set[str], limit: int) -> list[dict]:
    """Rows as {lowercased header: value}, starting at the first line that
    contains every `required` column (skips LinkedIn's prose preamble)."""
    lines = text.splitlines(keepends=True)
    start = None
    for i, line in enumerate(lines[:20]):
        cells = {c.strip().lower() for c in next(csv.reader([line]), [])}
        if required <= cells:
            start = i
            break
    if start is None:
        return []
    reader = csv.reader(io.StringIO("".join(lines[start:])))
    header = [h.strip().lower() for h in next(reader, [])]
    rows = []
    for values in reader:
        if not any(v.strip() for v in values):
            continue
        rows.append({header[i]: values[i].strip() for i in range(min(len(header), len(values)))})
        if len(rows) >= limit:
            break
    return rows


def _clip(value: str, limit: int) -> str:
    return (value or "").strip()[:limit]


# ---------------------------------------------------------------- entry point

def _collect_files(uploads) -> dict[str, str]:
    """{basename: decoded text} for the wanted files only, from either a
    single ZIP or a set of loose CSVs (Safari on macOS unzips downloads by
    default, so people often only have the folder)."""
    uploads = list(uploads)
    if not uploads:
        raise LinkedInImportError("Choose the ZIP file LinkedIn sent you.")
    if sum(getattr(u, "size", 0) or 0 for u in uploads) > MAX_UPLOAD_BYTES:
        raise LinkedInImportError(
            "That file is too large. Request only your Profile data from LinkedIn, not the full archive."
        )

    found: dict[str, str] = {}
    for upload in uploads:
        name = (getattr(upload, "name", "") or "").rsplit("/", 1)[-1].lower()
        data = upload.read(MAX_UPLOAD_BYTES + 1)
        if name.endswith(".zip") or data[:4] == b"PK\x03\x04":
            found.update(_read_zip(data))
        elif name in WANTED_FILES:
            if len(data) > MAX_FILE_BYTES:
                raise LinkedInImportError(f"{name} is larger than expected.")
            found[name] = _decode(data)
        # any other loose file (Connections.csv, messages.csv…) is ignored unread
    return found


def _read_zip(data: bytes) -> dict[str, str]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise LinkedInImportError("That doesn't look like a valid ZIP file.") from exc
    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_ZIP_ENTRIES:
            raise LinkedInImportError("That archive has too many files to be a LinkedIn export.")
        found = {}
        for info in infos:
            base = info.filename.rsplit("/", 1)[-1].lower()
            if base not in WANTED_FILES or info.is_dir():
                continue
            if info.flag_bits & 0x1:
                raise LinkedInImportError("That archive is password-protected.")
            if info.file_size > MAX_FILE_BYTES:
                raise LinkedInImportError(f"{base} is larger than expected.")
            with archive.open(info) as fh:
                found[base] = _decode(fh.read(MAX_FILE_BYTES + 1)[:MAX_FILE_BYTES])
        return found


def parse_linkedin_export(uploads) -> ParsedExport:
    files = _collect_files(uploads)
    if not files:
        raise LinkedInImportError(
            "We couldn't find your profile in that file. Make sure it's the archive from "
            "LinkedIn's \"Get a copy of your data\" with Profile selected."
        )

    result = ParsedExport(files_read=sorted(files))

    if "profile.csv" in files:
        rows = _rows(files["profile.csv"], WANTED_FILES["profile.csv"], 1)
        if rows:
            row = rows[0]
            name = " ".join(p for p in (row.get("first name", ""), row.get("last name", "")) if p)
            result.full_name = _clip(name, MAX_NAME)
            result.headline = _clip(row.get("headline", ""), MAX_HEADLINE)
            result.summary = _clip(row.get("summary", ""), MAX_SUMMARY)
            result.location = _clip(row.get("geo location") or row.get("location", ""), 120)

    if "positions.csv" in files:
        for row in _rows(files["positions.csv"], WANTED_FILES["positions.csv"], MAX_POSITIONS):
            org = _clip(row.get("company name", ""), MAX_ORG_NAME)
            if not org:
                continue
            result.positions.append(
                ParsedEntry(
                    org_name=org,
                    role=_clip(row.get("title", ""), MAX_ROLE),
                    started_on=parse_linkedin_date(row.get("started on", "")),
                    ended_on=parse_linkedin_date(row.get("finished on", "")),
                    kind="work",
                )
            )

    if "education.csv" in files:
        for row in _rows(files["education.csv"], WANTED_FILES["education.csv"], MAX_EDUCATION):
            school = _clip(row.get("school name", ""), MAX_ORG_NAME)
            if not school:
                continue
            degree = ", ".join(
                p for p in (row.get("degree name", ""), row.get("field of study", "")) if p
            )
            result.education.append(
                ParsedEntry(
                    org_name=school,
                    role=_clip(degree, MAX_ROLE),
                    started_on=parse_linkedin_date(row.get("start date", "")),
                    ended_on=parse_linkedin_date(row.get("end date", "")),
                    kind="education",
                )
            )

    if "skills.csv" in files:
        seen = set()
        for row in _rows(files["skills.csv"], WANTED_FILES["skills.csv"], MAX_SKILLS_READ):
            skill = row.get("name", "").strip()
            if skill and skill.lower() not in seen:
                seen.add(skill.lower())
                result.skills.append(skill)

    if result.is_empty:
        raise LinkedInImportError("Those files don't contain any profile information we can import.")
    return result
