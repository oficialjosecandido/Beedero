"""Automatic screening of feed photos (orgs/posting/moderation.py).

Content Safety is never actually called: `requests.post` is replaced, so a
test that expects no call can prove there was none.
"""

import base64
import io
import json

import pytest
import requests
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from billing.testing import grant_plan
from orgs.models import Activity, OrgMembership, Organization
from orgs.posting import moderation


def _png_bytes(size=(200, 200), color="red"):
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="PNG")
    return buf.getvalue()


def _upload(size=(200, 200)):
    return SimpleUploadedFile("photo.png", _png_bytes(size=size), content_type="image/png")


class FakeResponse:
    def __init__(self, scores):
        self._scores = scores

    def raise_for_status(self):
        pass

    def json(self):
        return {"categoriesAnalysis": [{"category": c, "severity": s} for c, s in self._scores.items()]}


class Screener:
    """Stands in for Content Safety. Set `scores` or `error` per test."""

    def __init__(self):
        self.scores = {"Sexual": 0, "Violence": 0, "Hate": 0, "SelfHarm": 0}
        self.error = None
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if self.error is not None:
            raise self.error
        return FakeResponse(self.scores)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    org = Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)
    grant_plan(org)
    return org


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def screener(settings, monkeypatch):
    settings.CONTENT_SAFETY_ENDPOINT = "https://screening.test/"
    settings.CONTENT_SAFETY_KEY = "test-key"
    settings.CONTENT_SAFETY_API_VERSION = "2024-09-01"
    settings.CONTENT_SAFETY_BLOCK_AT = 4
    settings.CONTENT_SAFETY_FLAG_AT = 2
    fake = Screener()
    monkeypatch.setattr(moderation.requests, "post", fake.post)
    return fake


def _post(api, org, **extra):
    return api.post(
        f"/api/orgs/{org.slug}/posts/",
        {"kind": "update", "body": "Look at this", **extra},
        format="multipart",
    )


@pytest.mark.django_db
def test_a_medium_severity_photo_is_refused_and_nothing_is_stored(api, org, founder, screener):
    api.force_authenticate(founder)
    screener.scores["Sexual"] = 4

    response = _post(api, org, image=_upload())

    assert response.status_code == 400
    assert "Terms of Service" in json.dumps(response.json())
    assert Activity.all_objects.count() == 0


@pytest.mark.django_db
def test_a_low_severity_photo_posts_and_waits_for_a_person(api, org, founder, screener):
    api.force_authenticate(founder)
    screener.scores["Violence"] = 2

    response = _post(api, org, image=_upload())
    assert response.status_code == 201

    activity = Activity.objects.get(pk=response.data["id"])
    assert activity.flagged_at is not None
    assert activity.flagged_reason == "violence:2"
    # Flagged is not removed: it is live and visible like any other post.
    assert activity.removed_at is None


@pytest.mark.django_db
def test_a_clean_photo_posts_with_no_flag(api, org, founder, screener):
    api.force_authenticate(founder)

    response = _post(api, org, image=_upload())
    assert response.status_code == 201

    activity = Activity.objects.get(pk=response.data["id"])
    assert activity.flagged_at is None and activity.flagged_reason == ""
    assert len(screener.calls) == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "error",
    [requests.Timeout("too slow"), requests.HTTPError("429 quota spent"), ValueError("nonsense back")],
)
def test_screening_failing_publishes_the_photo_flagged_instead_of_blocking(api, org, founder, screener, error):
    """The free tier stops at its limit rather than billing an overage, so a
    quota that runs out must not be able to close posting for everyone."""
    api.force_authenticate(founder)
    screener.error = error

    response = _post(api, org, image=_upload())
    assert response.status_code == 201

    activity = Activity.objects.get(pk=response.data["id"])
    assert activity.flagged_reason == moderation.UNSCREENED


@pytest.mark.django_db
def test_nothing_is_sent_when_screening_is_not_configured(api, org, founder, screener, settings):
    api.force_authenticate(founder)
    settings.CONTENT_SAFETY_ENDPOINT = ""

    response = _post(api, org, image=_upload())

    assert response.status_code == 201
    assert screener.calls == []
    assert Activity.objects.get(pk=response.data["id"]).flagged_reason == ""


@pytest.mark.django_db
def test_an_image_too_small_to_screen_is_not_sent(api, org, founder, screener):
    """Content Safety refuses anything under 50x50 — don't spend a call on it."""
    api.force_authenticate(founder)

    response = _post(api, org, image=_upload(size=(40, 30)))

    assert response.status_code == 201
    assert screener.calls == []


@pytest.mark.django_db
def test_a_post_with_no_photo_is_never_screened(api, org, founder, screener):
    api.force_authenticate(founder)

    assert _post(api, org).status_code == 201
    assert screener.calls == []


@pytest.mark.django_db
def test_the_call_sends_the_photo_and_the_key_and_nothing_else(api, org, founder, screener):
    api.force_authenticate(founder)

    _post(api, org, image=_upload())

    call = screener.calls[0]
    assert call["url"] == "https://screening.test/contentsafety/image:analyze"
    assert call["params"] == {"api-version": "2024-09-01"}
    assert call["headers"] == {"Ocp-Apim-Subscription-Key": "test-key"}
    assert call["timeout"] == moderation.TIMEOUT_SECONDS
    # Nobody's name, email or org travels with the photo.
    assert set(call["json"]) == {"image", "categories"}
    assert call["json"]["categories"] == list(moderation.CATEGORIES)
    sent = base64.b64decode(call["json"]["image"]["content"])
    with Image.open(io.BytesIO(sent)) as image:
        # Re-encoded: WebP is not among the formats Content Safety documents.
        assert image.format == "JPEG"


@pytest.mark.django_db
def test_a_personal_post_is_screened_the_same_way(api, db, screener):
    """The other half of the feed — same mixin, so the same screening."""
    investor = User.objects.create_user(username="investor", password="x")
    api.force_authenticate(investor)
    screener.scores["SelfHarm"] = 6

    response = api.post(
        "/api/investors/me/posts/",
        {
            "kind": "update",
            "title": "Update",
            "body": "hi",
            "occurred_at": "2026-07-21T10:00:00Z",
            "image": _upload(),
        },
        format="multipart",
    )

    assert response.status_code == 400
    assert Activity.all_objects.count() == 0


@pytest.mark.django_db
def test_the_thresholds_can_be_moved_without_a_deploy(api, org, founder, screener, settings):
    """Both thresholds are env-tunable, for when the queue is too noisy."""
    api.force_authenticate(founder)
    settings.CONTENT_SAFETY_FLAG_AT = 4
    screener.scores["Hate"] = 2

    response = _post(api, org, image=_upload())

    assert response.status_code == 201
    assert Activity.objects.get(pk=response.data["id"]).flagged_at is None
