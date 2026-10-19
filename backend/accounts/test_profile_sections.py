"""The contract the one-page profile editor relies on (frontend
app/(app)/profile/section-actions.ts): PUT /api/investors/me/ with a JSON
body carrying ONE section's fields changes only those fields, and a
one-key visibility change keeps every other section's audience."""

import pytest
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User


@pytest.fixture
def ana(db):
    user = User.objects.create_user(username="ana", email="ana@example.com", password="x")
    InvestorProfile.objects.create(
        user=user,
        full_name="Ana Silva",
        headline="Founder",
        country="PT",
        city="Lisboa",
        bio="Old bio",
        skills=["Python"],
        links=[{"label": "Site", "url": "https://acme.pt"}],
        visibility={"bio": "connections", "skills": "private"},
    )
    return user


@pytest.fixture
def api(ana):
    client = APIClient()
    client.force_authenticate(ana)
    return client


def _put(api, body):
    return api.put("/api/investors/me/", body, format="json")


@pytest.mark.django_db
def test_saving_one_section_leaves_the_others_alone(api, ana):
    res = _put(api, {"bio": "New bio", "manifesto": "", "links": [{"label": "Blog", "url": "https://b.pt"}]})
    assert res.status_code == 200, res.content
    p = InvestorProfile.objects.get(user=ana)
    assert p.bio == "New bio"
    assert p.links == [{"label": "Blog", "url": "https://b.pt"}]
    assert (p.headline, p.country, p.city, p.skills) == ("Founder", "PT", "Lisboa", ["Python"])


@pytest.mark.django_db
def test_skills_section_takes_a_json_list(api, ana):
    assert _put(api, {"skills": ["Python", "python", "Go"]}).status_code == 200
    assert InvestorProfile.objects.get(user=ana).skills == ["Python", "Go"]


@pytest.mark.django_db
def test_one_visibility_change_keeps_the_other_sections(api, ana):
    assert _put(api, {"visibility": {"memberships": "connections"}}).status_code == 200
    v = InvestorProfile.objects.get(user=ana).merged_visibility()
    assert v["memberships"] == "connections"
    assert v["bio"] == "connections"  # untouched
    assert v["skills"] == "private"  # untouched


@pytest.mark.django_db
def test_investment_focus_section_saves_lists_and_ticket(api, ana):
    body = {"stage_focus": ["seed"], "sector_focus": [], "geo_focus": ["PT"], "check_min": 25000, "check_max": None}
    assert _put(api, body).status_code == 200
    p = InvestorProfile.objects.get(user=ana)
    assert (p.stage_focus, p.geo_focus, p.check_min, p.check_max) == (["seed"], ["PT"], 25000, None)


@pytest.mark.django_db
def test_name_cannot_be_changed_once_set(api):
    assert _put(api, {"full_name": "Someone Else"}).status_code == 400
