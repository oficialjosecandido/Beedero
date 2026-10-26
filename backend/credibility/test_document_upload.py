"""The declared content type is uploader-chosen, so these tests are about
what the *bytes* have to look like before anything reaches the container."""

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from credibility.storage import (
    MAX_DOCUMENT_SIZE_BYTES,
    _validated_pdf_bytes,
    upload_private_document,
)

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"startxref\n9\n"
    b"%%EOF\n"
)


def pdf_file(content=MINIMAL_PDF, *, name="accounts.pdf", content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def test_accepts_a_well_formed_pdf():
    assert _validated_pdf_bytes(pdf_file()) == MINIMAL_PDF


def test_accepts_pdf_2_0():
    content = MINIMAL_PDF.replace(b"%PDF-1.4", b"%PDF-2.0")
    assert _validated_pdf_bytes(pdf_file(content)) == content


def test_accepts_an_xref_stream_pdf_with_no_trailer_keyword():
    # Linearised/encrypted PDFs carry an xref *stream* and no `trailer`.
    content = (
        b"%PDF-1.7\n"
        b"3 0 obj<</Type/XRef/W[1 2 1]>>stream\n\x00\x01\x00\nendstream endobj\n"
        b"startxref\n17\n%%EOF\n"
    )
    assert _validated_pdf_bytes(pdf_file(content)) == content


def test_rejects_html_wearing_a_pdf_content_type():
    # The whole point: the declared type says PDF, the bytes say otherwise.
    content = b"<html><script>alert(1)</script></html>"
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content))


def test_rejects_a_pdf_header_further_into_the_file():
    # A polyglot whose first bytes are markup and whose PDF starts later.
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(b"<html>\n" + MINIMAL_PDF))


def test_rejects_a_truncated_pdf():
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(MINIMAL_PDF[:30]))


def test_rejects_a_pdf_without_startxref():
    content = MINIMAL_PDF.replace(b"startxref\n9\n", b"")
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content))


def test_rejects_an_eof_marker_that_is_not_near_the_end():
    content = MINIMAL_PDF + b"\x00" * 4096
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content))


def test_rejects_an_empty_file():
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(b""))


def test_rejects_a_bogus_version():
    content = MINIMAL_PDF.replace(b"%PDF-1.4", b"%PDF-9.9")
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content))


def test_rejects_a_non_pdf_content_type():
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content_type="text/html"))


def test_rejects_an_oversized_file():
    content = MINIMAL_PDF + b"\x00" * MAX_DOCUMENT_SIZE_BYTES
    with pytest.raises(ValidationError):
        _validated_pdf_bytes(pdf_file(content))


def test_nothing_reaches_the_container_when_validation_fails(monkeypatch):
    def fail(*args, **kwargs):  # pragma: no cover - must never be called
        raise AssertionError("upload attempted for an invalid document")

    monkeypatch.setattr("credibility.storage._upload", fail)
    with pytest.raises(ValidationError):
        upload_private_document(pdf_file(b"<html></html>"), org_slug="acme")
