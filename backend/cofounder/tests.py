from django.core.cache import cache
import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from messaging.models import Conversation, MessageReport, UserBlock
from notifications.models import Notification
from orgs.models import OrgMembership

from .models import BuilderProfile, CofounderInterest, CofounderMatch, Strength
from .recommendations import DAILY_LIMIT, build_deck, daily_deck
from .services import (
    DENSITY_GATE,
    create_org_from_match,
    density_status,
    record_interest,
    set_outcome,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    try:
        cache.clear()
    except RuntimeError:
        pass
    yield
    try:
        cache.clear()
    except RuntimeError:
        pass


@pytest.fixture
def api():
    return APIClient()


def make_user(name, *, country="PT", verified=False):
    user = User.objects.create_user(
        username=name, email=f"{name}@example.com", password="x"
    )
    InvestorProfile.objects.create(
        user=user, full_name=name.title(), country=country, is_verified=verified
    )
    return user


def make_builder(user, *, strength=Strength.TECHNICAL, looking_for=("business",), **kwargs):
    return BuilderProfile.objects.create(
        user=user,
        is_active=kwargs.pop("is_active", True),
        adult_confirmed=True,
        primary_strength=strength,
        looking_for=list(looking_for),
        commitment=kwargs.pop("commitment", BuilderProfile.Commitment.FULL_TIME),
        **kwargs,
    )


@pytest.fixture
def alice(db):
    return make_user("alice")


@pytest.fixture
def bob(db):
    return make_user("bob")


@pytest.fixture
def carol(db):
    return make_user("carol")


# --- interest & matching ---------------------------------------------------


@pytest.mark.django_db
def test_one_sided_interest_creates_no_match(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])

    _, match = record_interest(alice, bob, True)

    assert match is None
    assert not CofounderMatch.objects.exists()


@pytest.mark.django_db
def test_mutual_interest_creates_match_conversation_and_notifies(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])

    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    assert match is not None
    # Canonical ordering, exactly like Conversation/Connection.
    assert match.user_a_id < match.user_b_id
    assert match.outcome == CofounderMatch.Outcome.MATCHED
    assert match.conversation_id is not None
    assert Conversation.objects.count() == 1
    for user in (alice, bob):
        assert Notification.objects.filter(
            user=user, kind=Notification.Kind.COFOUNDER_MATCH
        ).exists()


@pytest.mark.django_db
def test_pass_then_interest_is_reversible_and_still_matches(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])

    record_interest(alice, bob, False)
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    assert CofounderInterest.objects.filter(actor=alice, target=bob).count() == 1
    assert match is not None


@pytest.mark.django_db
def test_interest_requires_an_active_profile_of_your_own(alice, bob):
    make_builder(alice, is_active=False)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])

    with pytest.raises(PermissionDenied):
        record_interest(alice, bob, True)


@pytest.mark.django_db
def test_interest_in_a_blocked_user_is_refused(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    UserBlock.objects.create(blocker=bob, blocked=alice)

    with pytest.raises(PermissionDenied):
        record_interest(alice, bob, True)


@pytest.mark.django_db
def test_cannot_express_interest_in_yourself(alice):
    make_builder(alice)
    with pytest.raises(ValidationError):
        record_interest(alice, alice, True)


# --- the deck --------------------------------------------------------------


@pytest.mark.django_db
def test_deck_requires_complementarity_both_ways(alice, bob, carol):
    make_builder(alice, strength=Strength.TECHNICAL, looking_for=["business"])
    # Wants what Alice brings, brings what she wants — a real candidate.
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    # Brings what she wants but isn't looking for a technical co-founder.
    make_builder(carol, strength=Strength.BUSINESS, looking_for=["design"])

    deck = build_deck(alice)

    assert [b.user_id for b in deck] == [bob.id]


@pytest.mark.django_db
def test_deck_ranks_verified_identity_first(alice, db):
    make_builder(alice, strength=Strength.TECHNICAL, looking_for=["business"])
    unverified = make_user("dave", verified=False)
    verified = make_user("erin", verified=True)
    make_builder(unverified, strength=Strength.BUSINESS, looking_for=["technical"])
    make_builder(verified, strength=Strength.BUSINESS, looking_for=["technical"])

    deck = build_deck(alice)

    assert [b.user_id for b in deck] == [verified.id, unverified.id]


@pytest.mark.django_db
def test_deck_is_capped_at_the_daily_limit(alice, db):
    make_builder(alice, strength=Strength.TECHNICAL, looking_for=["business"])
    for i in range(DAILY_LIMIT + 4):
        make_builder(
            make_user(f"builder{i}"), strength=Strength.BUSINESS, looking_for=["technical"]
        )

    assert len(build_deck(alice)) == DAILY_LIMIT


@pytest.mark.django_db
def test_deck_is_stable_within_the_day_but_drops_decided_cards(alice, bob, carol):
    make_builder(alice, strength=Strength.TECHNICAL, looking_for=["business"])
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    make_builder(carol, strength=Strength.BUSINESS, looking_for=["technical"])

    first = [b.user_id for b in daily_deck(alice)]
    assert sorted(first) == sorted([bob.id, carol.id])

    record_interest(alice, bob, False)

    assert [b.user_id for b in daily_deck(alice)] == [carol.id]


@pytest.mark.django_db
def test_deck_is_empty_for_someone_who_has_not_opted_in(alice, bob):
    make_builder(alice, is_active=False)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])

    assert build_deck(alice) == []


# --- outcomes & the mother metric ------------------------------------------


@pytest.mark.django_db
def test_set_outcome_records_met(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    match = set_outcome(match, CofounderMatch.Outcome.MET)

    assert match.outcome == CofounderMatch.Outcome.MET


@pytest.mark.django_db
def test_formed_org_outcome_cannot_be_set_by_hand(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    with pytest.raises(ValidationError):
        set_outcome(match, CofounderMatch.Outcome.FORMED_ORG)


@pytest.mark.django_db
def test_create_org_from_match_makes_creator_owner_and_invites_the_other(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    org, invite = create_org_from_match(match, alice, "Northbound", "Freight, rebuilt.")
    match.refresh_from_db()

    assert match.org_id == org.id
    assert match.outcome == CofounderMatch.Outcome.FORMED_ORG
    assert OrgMembership.objects.get(org=org, user=alice).role == OrgMembership.Role.OWNER
    # Bob is invited, never silently added — consent stays explicit.
    assert not OrgMembership.objects.filter(org=org, user=bob).exists()
    assert invite.role == OrgMembership.Role.OWNER
    assert invite.max_uses == 1
    assert Notification.objects.filter(
        user=bob, kind=Notification.Kind.COFOUNDER_MATCH, link__contains=str(invite.token)
    ).exists()


@pytest.mark.django_db
def test_create_org_from_match_is_refused_twice(alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    create_org_from_match(match, alice, "Northbound")
    with pytest.raises(ValidationError):
        create_org_from_match(match, bob, "Southbound")


@pytest.mark.django_db
def test_create_org_from_match_refuses_a_stranger(alice, bob, carol):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    with pytest.raises(PermissionDenied):
        create_org_from_match(match, carol, "Hijack")


# --- density gate ----------------------------------------------------------


@pytest.mark.django_db
def test_density_gate_is_not_met_in_an_empty_market(alice):
    status = density_status(alice)
    assert status["gate_met"] is False
    assert status["threshold"] == DENSITY_GATE
    assert status["market"] == "PT"


# --- API -------------------------------------------------------------------


@pytest.mark.django_db
def test_profile_endpoint_creates_the_row_lazily_and_opted_out(api, alice):
    api.force_authenticate(alice)
    res = api.get("/api/cofounder/profile/")

    assert res.status_code == 200
    assert res.data["is_active"] is False
    assert BuilderProfile.objects.filter(user=alice).exists()


@pytest.mark.django_db
def test_cannot_go_live_with_an_incomplete_card(api, alice):
    api.force_authenticate(alice)
    res = api.patch(
        "/api/cofounder/profile/", {"is_active": True, "adult_confirmed": True}, format="json"
    )

    assert res.status_code == 400
    assert not BuilderProfile.objects.get(user=alice).is_active


@pytest.mark.django_db
def test_cannot_go_live_without_confirming_18_plus(api, alice):
    api.force_authenticate(alice)
    res = api.patch(
        "/api/cofounder/profile/",
        {
            "is_active": True,
            "primary_strength": "technical",
            "looking_for": ["business"],
            "commitment": "full_time",
        },
        format="json",
    )

    assert res.status_code == 400
    assert "adult_confirmed" in res.data


@pytest.mark.django_db
def test_profile_update_goes_live_when_complete(api, alice):
    api.force_authenticate(alice)
    res = api.patch(
        "/api/cofounder/profile/",
        {
            "is_active": True,
            "adult_confirmed": True,
            "primary_strength": "technical",
            "looking_for": ["business", "nonsense"],
            "commitment": "full_time",
            "prompts": {"why_building": "Because it needs to exist.", "junk": "dropped"},
        },
        format="json",
    )

    assert res.status_code == 200
    assert res.data["is_active"] is True
    assert res.data["looking_for"] == ["business"]
    assert res.data["prompts"] == {"why_building": "Because it needs to exist."}


@pytest.mark.django_db
def test_deck_endpoint_tells_an_opted_out_user_to_opt_in(api, alice, bob):
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    api.force_authenticate(alice)

    res = api.get("/api/cofounder/deck/")

    assert res.status_code == 200
    assert res.data["active"] is False
    assert res.data["cards"] == []


@pytest.mark.django_db
def test_deck_endpoint_shows_credibility_on_the_card(api, alice, db):
    make_builder(alice, strength=Strength.TECHNICAL, looking_for=["business"])
    verified = make_user("erin", verified=True)
    make_builder(
        verified,
        strength=Strength.BUSINESS,
        looking_for=["technical"],
        prompts={"superpower": "Shipping"},
    )
    verified.investorprofile.skills = ["Sales", "Ops"]
    verified.investorprofile.save()
    api.force_authenticate(alice)

    res = api.get("/api/cofounder/deck/")
    card = res.data["cards"][0]

    assert card["id"] == verified.id
    assert card["is_verified"] is True
    assert card["skills"] == ["Sales", "Ops"]
    assert card["prompts"] == {"superpower": "Shipping"}
    assert card["commitment_label"] == "Full-time"


@pytest.mark.django_db
def test_interest_endpoint_reports_the_match(api, alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(bob, alice, True)

    api.force_authenticate(alice)
    res = api.post(
        "/api/cofounder/interest/", {"target_id": bob.id, "liked": True}, format="json"
    )

    assert res.status_code == 201
    assert res.data["matched"] is True
    assert res.data["match"]["conversation_id"] is not None


@pytest.mark.django_db
def test_matches_endpoint_only_returns_your_own(api, alice, bob, carol):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    make_builder(carol, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    record_interest(bob, alice, True)

    api.force_authenticate(carol)
    res = api.get("/api/cofounder/matches/")

    assert res.data["results"] == []


@pytest.mark.django_db
def test_outcome_endpoint_404s_for_a_stranger(api, alice, bob, carol):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    api.force_authenticate(carol)
    res = api.post(
        f"/api/cofounder/matches/{match.id}/outcome/", {"outcome": "met"}, format="json"
    )

    assert res.status_code == 404


@pytest.mark.django_db
def test_status_endpoint_gates_promotion_but_not_access(api, alice):
    api.force_authenticate(alice)
    res = api.get("/api/cofounder/status/")

    assert res.status_code == 200
    assert res.data["gate_met"] is False
    assert res.data["show_entry_point"] is False

    make_builder(alice)
    res = api.get("/api/cofounder/status/")
    # Already in: the entry point stays, density or no density.
    assert res.data["show_entry_point"] is True


# --- safety (doc §7) -------------------------------------------------------


@pytest.mark.django_db
def test_chat_is_only_possible_after_a_match(api, alice, bob):
    """Doc §7: "chat apenas com match". There's no cofounder-specific message
    endpoint — the gate is that no Conversation exists until the match creates
    one, and /api/conversations/ still refuses to open one without a
    connection."""
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    api.force_authenticate(alice)

    # Seeing bob in the deck doesn't let alice message him.
    refused = api.post("/api/conversations/", {"user_id": bob.id}, format="json")
    assert refused.status_code == 403
    assert not Conversation.objects.exists()

    record_interest(alice, bob, True)
    _, match = record_interest(bob, alice, True)

    sent = api.post(
        f"/api/conversations/{match.conversation_id}/messages/",
        {"body": "hello"},
        format="json",
    )
    assert sent.status_code == 201


@pytest.mark.django_db
def test_a_deck_card_can_be_reported_before_any_match(api, alice, bob):
    """The report has to work at the moment the card is seen — that's the
    whole point of reporting a card. MessageReport.conversation is nullable
    for exactly this."""
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    api.force_authenticate(alice)

    res = api.post(
        "/api/reports/", {"user_id": bob.id, "reason": "scam"}, format="json"
    )

    assert res.status_code == 201
    report = MessageReport.objects.get()
    assert report.reported_user_id == bob.id
    assert report.conversation_id is None


@pytest.mark.django_db
def test_blocking_from_the_deck_removes_the_card_both_ways(api, alice, bob):
    make_builder(alice)
    make_builder(bob, strength=Strength.BUSINESS, looking_for=["technical"])
    assert [p.user_id for p in daily_deck(alice)] == [bob.id]
    assert [p.user_id for p in daily_deck(bob)] == [alice.id]

    api.force_authenticate(alice)
    assert api.post("/api/blocks/", {"user_id": bob.id}, format="json").status_code == 204

    # Not just for the blocker: bob stops seeing alice too, and the day's
    # cached deck doesn't keep either card alive.
    assert daily_deck(alice) == []
    assert daily_deck(bob) == []
