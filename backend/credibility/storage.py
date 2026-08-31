"""Private document storage for credibility documents (accounts, tax
certificates, registry filings, ...) — deliberately not the default `media`
backend, which serves everything by direct public URL. Documents here are
only ever reachable via a short-lived SAS URL minted on demand (doc §6,
pre-requisite before nivel 3); callers are responsible for gating who's
allowed to ask for one (see credibility.views.VerificationDocumentView).
"""

import uuid
from datetime import timedelta

from azure.storage.blob import BlobSasPermissions, BlobServiceClient, ContentSettings, generate_blob_sas
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPE = "application/pdf"


def _account_url() -> str:
    return f"https://{settings.AZURE_ACCOUNT_NAME}.blob.core.windows.net"


def _blob_service_client() -> BlobServiceClient:
    return BlobServiceClient(account_url=_account_url(), credential=settings.AZURE_ACCOUNT_KEY)


def upload_private_document(file, *, org_slug: str) -> str:
    """Validates and uploads an in-memory file to the private container.
    Returns the generated blob name — never the original filename, which
    avoids both leaking it and name collisions."""
    if file.size > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError("File must be 10MB or smaller.")
    if getattr(file, "content_type", None) != ALLOWED_CONTENT_TYPE:
        raise ValidationError("Only PDF files are accepted.")

    blob_name = f"{org_slug}/{uuid.uuid4().hex}.pdf"
    container = _blob_service_client().get_container_client(settings.AZURE_DOCS_PRIVATE_CONTAINER)
    container.upload_blob(
        blob_name,
        file.read(),
        content_settings=ContentSettings(content_type=ALLOWED_CONTENT_TYPE),
    )
    return blob_name


def upload_private_credential_document(file, *, user_id: int) -> str:
    """Same validation/container as `upload_private_document`, separate
    function (not a shared signature) so the org-scoped call sites here
    stay untouched — person-scoped credentials live under their own blob
    prefix instead of an org slug."""
    if file.size > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError("File must be 10MB or smaller.")
    if getattr(file, "content_type", None) != ALLOWED_CONTENT_TYPE:
        raise ValidationError("Only PDF files are accepted.")

    blob_name = f"credentials/{user_id}/{uuid.uuid4().hex}.pdf"
    container = _blob_service_client().get_container_client(settings.AZURE_DOCS_PRIVATE_CONTAINER)
    container.upload_blob(
        blob_name,
        file.read(),
        content_settings=ContentSettings(content_type=ALLOWED_CONTENT_TYPE),
    )
    return blob_name


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
