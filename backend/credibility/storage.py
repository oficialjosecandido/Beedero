"""Private document storage for credibility documents (accounts, tax
certificates, registry filings, ...) — deliberately not the default `media`
backend, which serves everything by direct public URL. Documents here are
only ever reachable via a short-lived SAS URL minted on demand (doc §6,
pre-requisite before nivel 3); callers are responsible for gating who's
allowed to ask for one (see credibility.views.VerificationDocumentView).
"""

import re
import uuid
from datetime import timedelta

from azure.storage.blob import BlobSasPermissions, BlobServiceClient, ContentSettings, generate_blob_sas
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPE = "application/pdf"

# `%PDF-1.x` or `%PDF-2.x`, which every PDF ever written starts with.
PDF_HEADER_RE = re.compile(rb"^%PDF-[12]\.[0-9]")
# A PDF ends with `%%EOF`; readers look for it near the end of the file, and
# the spec puts it in the last 1024 bytes. Doubling that leaves room for
# trailing newlines added in transit without accepting a file that merely
# mentions the marker somewhere in the middle.
PDF_TRAILER_WINDOW = 2048


def _account_url() -> str:
    return f"https://{settings.AZURE_ACCOUNT_NAME}.blob.core.windows.net"


def _blob_service_client() -> BlobServiceClient:
    return BlobServiceClient(account_url=_account_url(), credential=settings.AZURE_ACCOUNT_KEY)


def _validated_pdf_bytes(file) -> bytes:
    """Return the file's bytes, or raise ValidationError.

    `content_type` is whatever the browser put in the multipart part — the
    uploader chooses it, so on its own it proves nothing: a `.html` renamed
    to `.pdf` and announced as `application/pdf` passes that check. It stays
    as a cheap first gate (it rejects honest mistakes with a clear message)
    and the structure is then checked against the bytes that actually arrived.

    Structure, not content: header, version, trailer marker and the
    mandatory `startxref` keyword. That is enough to establish the file is a
    PDF rather than something else wearing the extension, which is the thing
    the declared type cannot tell us.

    Deliberately *not* rejected: embedded JavaScript and form actions. The
    documents this flow exists for include AT and Seguranca Social clearance
    certificates, which are routinely XFA forms carrying exactly that — a
    filter on `/JavaScript` would reject the real documents and keep nothing
    useful out, since the blob is only ever handed back over a short-lived
    SAS URL with a forced `application/pdf` content type.
    """
    if getattr(file, "content_type", None) != ALLOWED_CONTENT_TYPE:
        raise ValidationError("Only PDF files are accepted.")

    # `file.size` is the stored/measured size for Django's upload handlers,
    # but the bytes are what gets uploaded, so the limit is enforced on them.
    if file.size > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError("File must be 10MB or smaller.")

    if hasattr(file, "seek"):
        file.seek(0)
    data = file.read()

    if len(data) > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError("File must be 10MB or smaller.")
    if not data:
        raise ValidationError("File is empty.")
    if not PDF_HEADER_RE.match(data):
        raise ValidationError("Only PDF files are accepted.")
    if b"%%EOF" not in data[-PDF_TRAILER_WINDOW:]:
        raise ValidationError("That PDF looks truncated or damaged.")
    # Present in both classic cross-reference tables and xref streams, so this
    # accepts linearised and encrypted PDFs that have no `trailer` keyword.
    if b"startxref" not in data:
        raise ValidationError("That PDF looks truncated or damaged.")

    return data


def _upload(data: bytes, blob_name: str) -> str:
    container = _blob_service_client().get_container_client(settings.AZURE_DOCS_PRIVATE_CONTAINER)
    container.upload_blob(
        blob_name,
        data,
        content_settings=ContentSettings(content_type=ALLOWED_CONTENT_TYPE),
    )
    return blob_name


def upload_private_document(file, *, org_slug: str) -> str:
    """Validates and uploads an in-memory file to the private container.
    Returns the generated blob name — never the original filename, which
    avoids both leaking it and name collisions."""
    data = _validated_pdf_bytes(file)
    return _upload(data, f"{org_slug}/{uuid.uuid4().hex}.pdf")


def upload_private_credential_document(file, *, user_id: int) -> str:
    """Same validation/container as `upload_private_document`, separate
    function (not a shared signature) so the org-scoped call sites here
    stay untouched — person-scoped credentials live under their own blob
    prefix instead of an org slug."""
    data = _validated_pdf_bytes(file)
    return _upload(data, f"credentials/{user_id}/{uuid.uuid4().hex}.pdf")


def private_doc_url(blob_name: str, minutes: int = 10) -> str:
    sas = generate_blob_sas(
        account_name=settings.AZURE_ACCOUNT_NAME,
        container_name=settings.AZURE_DOCS_PRIVATE_CONTAINER,
        blob_name=blob_name,
        account_key=settings.AZURE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=timezone.now() + timedelta(minutes=minutes),
    )
    return f"{_account_url()}/{settings.AZURE_DOCS_PRIVATE_CONTAINER}/{blob_name}?{sas}"
