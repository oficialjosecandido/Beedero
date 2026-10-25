"""The person's onboarding — doc `beedero-aquisicao-pessoas.md` §6.3 and §6.4.

What is worth testing here is not that three fields save. It is the four
claims the flow rests on:

  * an intent is a private capability and never reaches a public payload (§9);
  * the handle is editable exactly once, during onboarding, and the one
  namespace it shares with organizations is respected;
  * the city is declared or absent — nothing infers it (§6.1);
  * the suggestions are local, actionable, and never leave somebody with five
  rows they cannot act on or an empty list when their city is quiet (§6.3).
"""

import pytest
from rest_framework.test import APIClient

from accounts.intents import Intent, clean_intents, primary_intent
from accounts.models import InvestorProfile, User
from accounts.testing import unlock
from connections.models import Connection, ConnectionRequest
from orgs.models import OrgFollow, OrgMembership, Organization
from orgs.testing import unlock_org


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def person(db):
    return User.objects.create_user(username="ana", email="ana@example.com", password="x")


@pytest.fixture
def signed_in(api, person):
    api.force_authenticate(person)
    return api


def _profile(user, **fields) -> InvestorProfile:
    profile, _ = InvestorProfile.objects.get_or_create(user=user)
    for key, value in fields.items():
        setattr(profile, key, value)
    if fields:
        profile.save()
    return profile


def _other(username, *, city="Lisboa", skills=None, verified=False, name=None):
    user = User.objects.create_user(
        username=username, email=f"{username}@example.com", password="x"
    )
    profile = _profile(
        user,
        full_name=name or username.title(),
        city=city,
        skills=skills or [],
        is_verified=verified,
        handle=username,
    )
    # Suggested people must be past the ladder's gate (accounts/ladder.py).
    profile = unlock(user)
    return user, profile


def _live_org(slug, *, name=None, verified=False, member=None):
    org = Organization.objects.create(
        slug=slug, name=name or slug.title(), status=Organization.Status.LIVE, is_verified=verified
    )
    if member is not None:
        OrgMembership.objects.create(org=org, user=member, role=OrgMembership.Role.MEMBER)
    # Suggested organisations must be past their ladder's gate (orgs/ladder.py).
    return unlock_org(org)


# --- the vocabulary: unknown values must not become routing instructions -----


@pytest.mark.parametrize(
    "raw,expected",
    [
        (["job", "invest"], ["job", "invest"]),
        # Stored in vocabulary order whatever order they were ticked in, so
        # `primary_intent` is deterministic.
        (["explore", "job"], ["job", "explore"]),
        (["job", "job"], ["job"]),
        # A sixth option means an out-of-date client; the valid ones still count.
        (["job", "astronaut"], ["job"]),
        (["astronaut"], []),
        ([], []),
        ("job", []),  # a bare string is not a multiple choice
        (None, []),
        ([None, 1, True], []),
    ],
)
def test_clean_intents(raw, expected):
    assert clean_intents(raw) == expected


def test_primary_intent_follows_the_table_order():
    # §6.4 lists job before explore, and somebody who picked both is looking
    # for work — the feed is what you show when there is nothing stronger.
    assert primary_intent(["explore", "job"]) == Intent.JOB
    assert primary_intent(["explore"]) == Intent.EXPLORE
    assert primary_intent([]) == ""


def test_intents_are_capped():
    from accounts.intents import MAX_INTENTS

    assert len(clean_intents(Intent.values * 3)) == MAX_INTENTS


# --- §9: "capacidades privadas, nunca rótulos no perfil público" ------------


def test_intents_never_appear_on_the_public_profile(api, person):
    # headline and country as well as the name: `is_complete` gates the public
    # page, and a half-filled profile 404s before it can leak anything.
    profile = _profile(
        person,
        full_name="Ana Silva",
        headline="Backend engineer",
        country="PT",
        city="Lisboa",
        handle="anasilva",
    )
    profile.intents = ["job", "invest"]
    profile.save()

    res = api.get(f"/api/public/people/{profile.handle}/")

    assert res.status_code == 200
    body = res.json()
    flat = str(body)
    assert "intents" not in body
    assert "invest" not in flat
    assert "onboarding_completed_at" not in body


def test_intents_are_not_in_the_profile_serializer(signed_in, person):
    _profile(person, full_name="Ana Silva")
    InvestorProfile.objects.filter(user=person).update(intents=["job"])

    res = signed_in.get("/api/investors/me/")

    assert res.status_code == 200
    # Not even to the owner through this endpoint: the one reader is
    # /api/onboarding/, so there is a single place to audit.
    assert "intents" not in res.json()


def test_intents_are_readable_by_the_person_themselves(signed_in, person):
    signed_in.post("/api/onboarding/", {"step": "intents", "intents": ["invest", "job"]}, format="json")

    res = signed_in.get("/api/onboarding/")

    assert res.status_code == 200
    assert res.json()["intents"] == ["job", "invest"]
    assert res.json()["primary_intent"] == "job"


def test_intent_options_come_from_one_vocabulary(signed_in):
    res = signed_in.get("/api/onboarding/intents/")

    assert res.status_code == 200
    assert [item["value"] for item in res.json()["items"]] == list(Intent.values)


# --- step 1: identity -------------------------------------------------------


def test_identity_saves_name_city_and_headline(signed_in, person):
    res = signed_in.post(
        "/api/onboarding/",
        {
            "step": "identity",
            "full_name": "Ana Silva",
            "city": "Lisboa",
            "headline": "Backend engineer",
        },
        format="json",
    )

    assert res.status_code == 200
    profile = InvestorProfile.objects.get(user=person)
    assert profile.full_name == "Ana Silva"
    assert profile.headline == "Backend engineer"
    assert profile.city == "Lisboa"
    # Derived in save(), so the city is countable and filterable at once.
    assert profile.city_key == "lisbon"


def test_identity_requires_a_city(signed_in):
    res = signed_in.post(
        "/api/onboarding/", {"step": "identity", "full_name": "Ana Silva"}, format="json"
    )

    # §6.1: "Declarada no onboarding, nunca deduzida do IP" — so a blank city
    # has to come back as a question, because there is no other way to get it.
    assert res.status_code == 400
    assert "city" in res.json()


def test_identity_requires_a_name(signed_in):
    res = signed_in.post("/api/onboarding/", {"step": "identity", "city": "Lisboa"}, format="json")

    assert res.status_code == 400
    assert "full_name" in res.json()


def test_a_name_already_set_is_not_overwritten(signed_in, person):
    _profile(person, full_name="Ana Silva")

    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Someone Else", "city": "Porto"},
        format="json",
    )

    assert res.status_code == 200
    # Every confirmed affiliation and verification was issued against the name
    # on the profile; onboarding is not a way around that.
    assert InvestorProfile.objects.get(user=person).full_name == "Ana Silva"


def test_step_one_always_leaves_a_public_handle(signed_in, person):
    signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa"},
        format="json",
    )

    assert InvestorProfile.objects.get(user=person).handle == "anasilva"


def test_a_chosen_handle_wins_over_the_derived_one(signed_in, person):
    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa", "handle": "@anabuilds"},
        format="json",
    )

    assert res.status_code == 200
    assert InvestorProfile.objects.get(user=person).handle == "anabuilds"


def test_a_handle_an_org_already_answers_to_is_refused(signed_in, person):
    _live_org("acme")

    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa", "handle": "acme"},
        format="json",
    )

    # People and orgs share one namespace (beedero/handles.py), and /o/acme
    # already exists.
    assert res.status_code == 400
    assert "handle" in res.json()


@pytest.mark.parametrize("bad", ["ana silva", "ana-silva", "Ana!", "ana_silva"])
def test_an_unusable_handle_is_refused(signed_in, bad):
    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa", "handle": bad},
        format="json",
    )

    assert res.status_code == 400
    assert "handle" in res.json()


def test_the_handle_freezes_once_onboarding_is_done(signed_in, person):
    signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa"},
        format="json",
    )
    signed_in.post("/api/onboarding/", {"step": "complete"}, format="json")

    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa", "handle": "anabuilds"},
        format="json",
    )

    # /p/<handle> has been shareable since the moment it was assigned; from
    # here on it is an address somebody may already have posted.
    assert res.status_code == 400
    assert InvestorProfile.objects.get(user=person).handle == "anasilva"
    assert signed_in.get("/api/onboarding/").json()["handle_locked"] is True


def test_the_same_handle_resubmitted_is_not_a_conflict(signed_in, person):
    signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Lisboa", "handle": "anabuilds"},
        format="json",
    )

    res = signed_in.post(
        "/api/onboarding/",
        {"step": "identity", "full_name": "Ana Silva", "city": "Porto", "handle": "anabuilds"},
        format="json",
    )

    # Going back a step and pressing save again is not a claim on a new handle.
    assert res.status_code == 200
    assert InvestorProfile.objects.get(user=person).city == "Porto"


# --- completion: a record of having been through, not of being finished -----


def test_completion_is_idempotent(signed_in, person):
    signed_in.post("/api/onboarding/", {"step": "complete"}, format="json")
    first = InvestorProfile.objects.get(user=person).onboarding_completed_at

    signed_in.post("/api/onboarding/", {"step": "complete"}, format="json")

    assert InvestorProfile.objects.get(user=person).onboarding_completed_at == first


def test_completion_does_not_require_a_finished_profile(signed_in, person):
    # §6.3's step 3 "pode saltar-se", so somebody can finish the flow with
    # nothing but a name and a city — and must not be sent round again.
    res = signed_in.post("/api/onboarding/", {"step": "complete"}, format="json")

    assert res.status_code == 200
    assert res.json()["completed"] is True


def test_an_unknown_step_is_refused(signed_in):
    res = signed_in.post("/api/onboarding/", {"step": "pdf"}, format="json")

    assert res.status_code == 400


def test_onboarding_needs_a_session(api, db):
    assert api.get("/api/onboarding/").status_code in (401, 403)
    assert api.get("/api/onboarding/suggestions/").status_code in (401, 403)


# --- the closing screen: five suggestions worth acting on -------------------


def test_suggestions_are_from_the_declared_city(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    lisbon_member, _ = _other("tiago", city="Lisboa")
    porto_member, _ = _other("rita", city="Porto")
    _live_org("lisbonco", member=lisbon_member)
    _live_org("portoco", member=porto_member)

    res = signed_in.get("/api/onboarding/suggestions/")

    assert res.status_code == 200
    body = res.json()
    local = {org["slug"] for org in body["orgs"] if org["is_local"]}
    # PortoCo may still appear as fallback — a two-row screen is worse than a
    # five-row one — but only the Lisbon org is labelled local.
    assert local == {"lisbonco"}
    assert [p["handle"] for p in body["people"]] == ["tiago"]
    assert body["is_local"] is True


def test_suggestions_match_spelling_variants_of_a_city(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisbon")
    _other("tiago", city="Lisboa")

    body = signed_in.get("/api/onboarding/suggestions/").json()

    # accounts/cities.py folds the two spellings into one city, so a person who
    # typed "Lisbon" is in the same scene as one who typed "Lisboa".
    assert [p["handle"] for p in body["people"]] == ["tiago"]


def test_people_in_the_same_area_come_first(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa", skills=["Django", "Postgres"])
    _other("sameArea".lower(), city="Lisboa", skills=["Django"])
    _other("otherarea", city="Lisboa", skills=["Design"])

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert [p["handle"] for p in body["people"]][0] == "samearea"


def test_suggestions_exclude_people_there_is_nothing_left_to_do_with(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    connected, _ = _other("connected", city="Lisboa")
    asked, _ = _other("asked", city="Lisboa")
    asking, _ = _other("asking", city="Lisboa")
    _other("available", city="Lisboa")

    pair = sorted([person, connected], key=lambda u: u.id)
    Connection.objects.create(user_one=pair[0], user_two=pair[1])
    ConnectionRequest.objects.create(requester=person, recipient=asked)
    ConnectionRequest.objects.create(requester=asking, recipient=person)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    handles = [p["handle"] for p in body["people"]]
    assert handles == ["available"]


def test_suggestions_exclude_orgs_already_followed(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    member, _ = _other("tiago", city="Lisboa")
    followed = _live_org("followedco", member=member)
    _live_org("newco", member=member)
    OrgFollow.objects.create(user=person, org=followed)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert [org["slug"] for org in body["orgs"]] == ["newco"]


def test_draft_orgs_are_never_suggested(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    member, _ = _other("tiago", city="Lisboa")
    draft = Organization.objects.create(
        slug="draftco", name="DraftCo", status=Organization.Status.DRAFT
    )
    OrgMembership.objects.create(org=draft, user=member, role=OrgMembership.Role.MEMBER)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert [org["slug"] for org in body["orgs"]] == []


def test_an_org_with_several_local_members_is_one_suggestion(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    one, _ = _other("tiago", city="Lisboa")
    two, _ = _other("rita", city="Lisboa")
    org = _live_org("lisbonco", member=one)
    OrgMembership.objects.create(org=org, user=two, role=OrgMembership.Role.MEMBER)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert [org["slug"] for org in body["orgs"]] == ["lisbonco"]


def test_a_quiet_city_still_fills_the_screen(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Évora")
    for index in range(6):
        _live_org(f"elsewhere{index}", verified=index < 3)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    # Nobody local yet, but the person asked for a feed — so the fallback fills
    # it and `is_local` says plainly that this is not their city's scene.
    assert len(body["orgs"]) == 5
    assert body["is_local"] is False
    assert all(org["is_verified"] for org in body["orgs"][:3])


def test_a_person_without_a_city_gets_the_fallback(signed_in, person):
    _profile(person, full_name="Ana Silva")
    _other("tiago", city="Lisboa")
    _live_org("anyco")

    body = signed_in.get("/api/onboarding/suggestions/").json()

    # No city, so no "mesma cidade" to match — and suggesting people from a
    # city they never declared would be inventing the thing §6.1 refuses.
    assert body["people"] == []
    assert [org["slug"] for org in body["orgs"]] == ["anyco"]
    assert body["is_local"] is False


def test_people_keep_room_on_a_busy_screen(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    member, _ = _other("tiago", city="Lisboa")
    _other("rita", city="Lisboa")
    _other("joao", city="Lisboa")
    for index in range(6):
        _live_org(f"lisbonco{index}", member=member)

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert len(body["orgs"]) == 3
    assert len(body["people"]) == 2
    assert len(body["orgs"]) + len(body["people"]) == 5


def test_suggestions_never_include_the_person_themselves(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa", handle="anasilva")

    body = signed_in.get("/api/onboarding/suggestions/").json()

    assert "anasilva" not in [p["handle"] for p in body["people"]]


def test_suggested_people_can_always_be_reached(signed_in, person):
    _profile(person, full_name="Ana Silva", city="Lisboa")
    _other("tiago", city="Lisboa")
    nameless = User.objects.create_user(username="ghost", email="ghost@example.com", password="x")
    _profile(nameless, city="Lisboa")

    body = signed_in.get("/api/onboarding/suggestions/").json()

    # Every card links to /p/<handle>, so a profile without one is a dead row.
    assert all(p["handle"] for p in body["people"])
    assert "ghost" not in [p["handle"] for p in body["people"]]
