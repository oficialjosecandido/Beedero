"""Team invites by email — doc `beedero-aquisicao-pessoas.md` §2.

This is the only place in Beedero that emails someone who never asked to hear
from us, so the tests that matter are the ones about restraint: that nothing is
accepted on anyone's behalf, that the limits hold, that one invite means one
email, that refusing needs no account, and that a declined address is forgotten.
"""

from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from affiliations.models import (
    Affiliation,
    RoleType,
    TeamInvite,
    TeamInviteOptOut,
    TeamInviteReport,
)
from affiliations.serializers import mask_email
from affiliations.team_invites import (
    OptedOut,
    accept_team_invite,
    decline_team_invite,
    expire_invites,
    invite_team_member,
    report_team_invite,
    send_due_reminders,
)
from orgs.models import Organization, OrgMembership


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def founder(db):
    user = User.objects.create_user(username="founder", email="founder@waverent.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="Fiona Founder", handle="fionafounder")
    return user


@pytest.fixture
def org(db, founder):
    from billing.testing import grant_plan

    org = Organization.objects.create(
        name="WaveRent", slug="waverent", status=Organization.Status.LIVE
    )
    OrgMembership.objects.create(org=org, user=founder, role=OrgMembership.Role.OWNER)
    grant_plan(org)
    return org


@pytest.fixture
def outsider(db):
    """Somebody who signed up after being invited — a verified address."""
    user = User.objects.create_user(username="ada", email="ada@example.com", password="x")
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    InvestorProfile.objects.create(user=user, full_name="Ada Lovelace", handle="adalovelace")
    return user


def _invite(org, founder, email="ada@example.com", **kwargs):
    kind, obj = invite_team_member(
        founder, org, email=email, role=RoleType.EMPLOYEE, title="Engineer", **kwargs
    )
    return kind, obj


# --- who gets an email at all ----------------------------------------------


@pytest.mark.django_db
def test_person_with_no_account_is_emailed_once(org, founder, django_capture_on_commit_callbacks):
    # The send is deferred to commit on purpose — an email about an invite that
    # failed to save is an email about nothing — so the test has to commit.
    with django_capture_on_commit_callbacks(execute=True):
        kind, invite = _invite(org, founder)
    assert kind == "invite"
    assert invite.email == "ada@example.com"
    assert len(mail.outbox) == 1
    body = mail.outbox[0].body
    # §2.4: every email carries a way out.
    assert f"/invite/team/{invite.token}" in body
    assert "answer=no" in body


@pytest.mark.django_db
def test_person_who_already_has_an_account_is_not_emailed(org, founder, outsider):
    """§2.2 step 2: an existing member gets the in-app flow, not a cold email."""
    kind, affiliation = _invite(org, founder, email=outsider.email)
    assert kind == "affiliation"
    assert affiliation.status == Affiliation.Status.PENDING
    assert mail.outbox == []


@pytest.mark.django_db
def test_email_is_matched_case_insensitively_against_existing_accounts(
    org, founder, outsider
):
    kind, _ = _invite(org, founder, email="ADA@Example.COM")
    assert kind == "affiliation"
    assert mail.outbox == []


@pytest.mark.django_db
def test_founder_role_cannot_be_handed_out_by_an_org(org, founder):
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        invite_team_member(founder, org, email="ada@example.com", role=RoleType.FOUNDER)
    assert TeamInvite.objects.count() == 0


# --- one invite, one reminder ----------------------------------------------


@pytest.mark.django_db
def test_second_invite_to_the_same_address_is_refused(
    org, founder, django_capture_on_commit_callbacks
):
    from rest_framework.exceptions import ValidationError

    with django_capture_on_commit_callbacks(execute=True):
        _invite(org, founder)
    with pytest.raises(ValidationError):
        _invite(org, founder)
    # The refusal is what matters, but so is this: the second attempt queued
    # nothing, so no amount of clicking turns one invite into two emails.
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_reminder_is_sent_once_after_three_days(org, founder):
    _, invite = _invite(org, founder)
    mail.outbox.clear()

    # Too soon.
    assert send_due_reminders() == 0

    TeamInvite.objects.filter(pk=invite.pk).update(
        created_at=timezone.now() - timedelta(days=4)
    )
    assert send_due_reminders() == 1
    assert len(mail.outbox) == 1
    assert "Reminder" in mail.outbox[0].subject

    # And never again — §2.4's "no máximo um".
    assert send_due_reminders() == 0
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_an_answered_invite_gets_no_reminder(org, founder):
    _, invite = _invite(org, founder)
    decline_team_invite(invite)
    TeamInvite.objects.filter(pk=invite.pk).update(
        created_at=timezone.now() - timedelta(days=4)
    )
    mail.outbox.clear()
    assert send_due_reminders() == 0
    assert mail.outbox == []


# --- limits ----------------------------------------------------------------


@pytest.mark.django_db
def test_daily_limit_holds(org, founder):
    from rest_framework.exceptions import ValidationError

    for i in range(TeamInvite.MAX_PER_DAY):
        _invite(org, founder, email=f"person{i}@example.com")
    with pytest.raises(ValidationError):
        _invite(org, founder, email="one-too-many@example.com")
    assert TeamInvite.objects.count() == TeamInvite.MAX_PER_DAY


@pytest.mark.django_db
def test_weekly_limit_holds_across_days(org, founder):
    from rest_framework.exceptions import ValidationError

    # Backdate so the daily limit isn't what stops us.
    for i in range(TeamInvite.MAX_PER_WEEK):
        _, invite = _invite(org, founder, email=f"person{i}@example.com")
        TeamInvite.objects.filter(pk=invite.pk).update(
            created_at=timezone.now() - timedelta(days=3)
        )
    with pytest.raises(ValidationError):
        _invite(org, founder, email="one-too-many@example.com")


# --- opting out ------------------------------------------------------------


@pytest.mark.django_db
def test_opted_out_address_is_never_invited(org, founder):
    TeamInviteOptOut.objects.create(email="ada@example.com", org=org)
    with pytest.raises(OptedOut):
        _invite(org, founder)
    # Not merely unsent — never written.
    assert TeamInvite.objects.count() == 0
    assert mail.outbox == []


@pytest.mark.django_db
def test_global_opt_out_covers_every_org(org, founder, db):
    other = Organization.objects.create(
        name="Other", slug="other", status=Organization.Status.LIVE
    )
    OrgMembership.objects.create(org=other, user=founder, role=OrgMembership.Role.OWNER)
    TeamInviteOptOut.objects.create(email="ada@example.com", org=None)

    with pytest.raises(OptedOut):
        _invite(org, founder)
    with pytest.raises(OptedOut):
        _invite(other, founder)


@pytest.mark.django_db
def test_the_org_cannot_tell_it_was_blocked(api, org, founder):
    """An opt-out that is reportable is not an opt-out — it's a disclosure."""
    TeamInviteOptOut.objects.create(email="ada@example.com", org=org)
    api.force_authenticate(founder)
    res = api.post(
        f"/api/orgs/{org.slug}/team-invites/",
        {"email": "ada@example.com", "role": "employee", "title": "Engineer"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json() == {"kind": "invite", "item": None}
    assert mail.outbox == []
    assert TeamInvite.objects.count() == 0


# --- accepting -------------------------------------------------------------


@pytest.mark.django_db
def test_accepting_creates_a_verified_affiliation(org, founder, outsider):
    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        title="Engineer",
        invited_by=founder,
        expires_at=timezone.now() + timedelta(days=30),
    )
    affiliation = accept_team_invite(invite, outsider)

    # Both parties spoke: the org wrote the invite, the person accepted it.
    assert affiliation.status == Affiliation.Status.VERIFIED
    assert affiliation.verified_via == Affiliation.VerifiedVia.ORG
    invite.refresh_from_db()
    assert invite.accepted_at is not None
    # §2.2: the address does not outlive the invite.
    assert invite.email == ""


@pytest.mark.django_db
def test_accepting_attributes_the_signup_to_the_invite(org, founder, outsider):
    """§8.2: an accepted team invite sets signup_source="invite"."""
    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        invited_by=founder,
        expires_at=timezone.now() + timedelta(days=30),
    )
    accept_team_invite(invite, outsider)
    outsider.refresh_from_db()
    assert (outsider.signup_source, outsider.signup_ref) == ("invite", "invite:waverent")


@pytest.mark.django_db
def test_an_earlier_origin_is_not_overwritten_by_an_invite(org, founder, outsider):
    outsider.signup_source = "job"
    outsider.signup_ref = "job:7"
    outsider.save(update_fields=["signup_source", "signup_ref"])
    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        invited_by=founder,
        expires_at=timezone.now() + timedelta(days=30),
    )
    accept_team_invite(invite, outsider)
    outsider.refresh_from_db()
    assert outsider.signup_ref == "job:7"


@pytest.mark.django_db
def test_someone_else_holding_the_link_cannot_accept(org, founder, outsider):
    """The link is a bearer token in an inbox. Whoever finds it must not be
    able to mint a verified affiliation for themselves."""
    from rest_framework.exceptions import ValidationError

    thief = User.objects.create_user(username="thief", email="thief@example.com", password="x")
    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        invited_by=founder,
        expires_at=timezone.now() + timedelta(days=30),
    )
    with pytest.raises(ValidationError):
        accept_team_invite(invite, thief)
    assert Affiliation.objects.count() == 0
    assert outsider.pk  # the real invitee is untouched


@pytest.mark.django_db
def test_an_expired_invite_cannot_be_accepted(org, founder, outsider):
    from rest_framework.exceptions import ValidationError

    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        invited_by=founder,
        expires_at=timezone.now() - timedelta(minutes=1),
    )
    with pytest.raises(ValidationError):
        accept_team_invite(invite, outsider)


@pytest.mark.django_db
def test_nothing_is_accepted_by_merely_signing_in(org, founder):
    """§9: acceptance is an explicit screen, never a side effect. Provisioning
    a user whose address has an open invite must leave the invite open."""
    from accounts.provisioning import get_or_provision_firebase_user

    _, invite = _invite(org, founder)
    user = get_or_provision_firebase_user(
        {"uid": "fb-ada", "email": "ada@example.com", "email_verified": True}
    )
    invite.refresh_from_db()
    assert invite.accepted_at is None
    assert invite.is_open
    assert Affiliation.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_accepting_through_the_api(api, org, founder, outsider):
    invite = TeamInvite.objects.create(
        org=org,
        email="ada@example.com",
        role=RoleType.EMPLOYEE,
        title="Engineer",
        invited_by=founder,
        expires_at=timezone.now() + timedelta(days=30),
    )
    api.force_authenticate(outsider)
    res = api.post(f"/api/team-invites/{invite.token}/accept/", {}, format="json")
    assert res.status_code == 201
    body = res.json()
    assert body["org"]["slug"] == "waverent"
    assert body["status"] == "verified"


@pytest.mark.django_db
def test_accepting_needs_a_session(api, org, founder):
    """Unlike declining — accepting writes a verified fact onto a profile."""
    _, invite = _invite(org, founder)
    res = api.post(f"/api/team-invites/{invite.token}/accept/", {}, format="json")
    assert res.status_code in (401, 403)
    assert Affiliation.objects.count() == 0


# --- declining -------------------------------------------------------------


@pytest.mark.django_db
def test_declining_needs_no_account(api, org, founder):
    """Making someone sign up in order to refuse would be the inverse of consent."""
    _, invite = _invite(org, founder)
    res = api.post(f"/api/public/team-invites/{invite.token}/decline/", {}, format="json")
    assert res.status_code == 204
    invite.refresh_from_db()
    assert invite.declined_at is not None
    assert invite.email == ""
    # Declining one invite is not blocking all of them.
    assert TeamInviteOptOut.objects.count() == 0


@pytest.mark.django_db
def test_declining_with_block_records_the_opt_out(api, org, founder):
    _, invite = _invite(org, founder)
    res = api.post(
        f"/api/public/team-invites/{invite.token}/decline/", {"block": True}, format="json"
    )
    assert res.status_code == 204
    assert TeamInviteOptOut.objects.filter(email="ada@example.com", org=org).exists()


# --- the public preview ----------------------------------------------------


@pytest.mark.django_db
def test_public_preview_masks_the_address(api, org, founder):
    _, invite = _invite(org, founder, name="Ada")
    res = api.get(f"/api/public/team-invites/{invite.token}/")
    assert res.status_code == 200
    body = res.json()

    assert body["org"]["name"] == "WaveRent"
    assert body["role"] == "employee"
    assert body["answer"] == "open"
    # Enough to recognise, not enough to harvest from a leaked link.
    assert body["email_hint"] == "a…@example.com"
    assert "ada@example.com" not in str(body)


@pytest.mark.parametrize(
    "email,expected",
    [
        # A short local part keeps one character, not two-and-two: on "ada"
        # the usual mask would spell the whole thing out.
        ("ada@example.com", "a…@example.com"),
        ("jo@example.com", "j…@example.com"),
        ("josevcandido@gmail.com", "jo…do@gmail.com"),
        ("not-an-address", ""),
        ("", ""),
    ],
)
def test_mask_email(email, expected):
    assert mask_email(email) == expected


@pytest.mark.django_db
def test_unknown_token_is_a_404(api):
    assert api.get("/api/public/team-invites/nope/").status_code == 404


# --- permissions -----------------------------------------------------------


@pytest.mark.django_db
def test_only_org_admins_can_invite(api, org, outsider):
    """§2.4: "Só admins da org enviam convites"."""
    api.force_authenticate(outsider)
    res = api.post(
        f"/api/orgs/{org.slug}/team-invites/",
        {"email": "new@example.com", "role": "employee"},
        format="json",
    )
    assert res.status_code in (403, 404)
    assert TeamInvite.objects.count() == 0


@pytest.mark.django_db
def test_invite_list_shows_the_quota(api, org, founder):
    _invite(org, founder)
    api.force_authenticate(founder)
    body = api.get(f"/api/orgs/{org.slug}/team-invites/").json()
    assert len(body["items"]) == 1
    assert body["quota"]["remaining_today"] == TeamInvite.MAX_PER_DAY - 1


# --- expiry ----------------------------------------------------------------


@pytest.mark.django_db
def test_expiry_forgets_the_address(org, founder):
    _, invite = _invite(org, founder)
    TeamInvite.objects.filter(pk=invite.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    assert expire_invites() == 1
    invite.refresh_from_db()
    assert invite.email == ""
    assert invite.answer == "expired"


@pytest.mark.django_db
def test_an_expired_invite_frees_the_address_for_a_new_one(org, founder):
    _, invite = _invite(org, founder)
    TeamInvite.objects.filter(pk=invite.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    expire_invites()
    # The open-invite constraint is conditional, so inviting again is allowed
    # once the first one is closed out.
    kind, _ = _invite(org, founder)
    assert kind == "invite"


# --- reports ---------------------------------------------------------------


@pytest.mark.django_db
def test_reporting_declines_blocks_and_files_a_complaint(api, org, founder):
    """One click, three effects — the screen says so, so the test says so."""
    _, invite = _invite(org, founder)
    res = api.post(
        f"/api/public/team-invites/{invite.token}/report/",
        {"reason": "not_me", "note": "I have never worked at WaveRent."},
        format="json",
    )
    assert res.status_code == 204

    invite.refresh_from_db()
    assert invite.answer == "declined"
    assert invite.email == ""
    assert TeamInviteOptOut.objects.filter(email="ada@example.com", org=org).exists()

    report = TeamInviteReport.objects.get()
    assert report.is_pending
    assert report.org_id == org.id
    assert report.reason == "not_me"
    assert report.note == "I have never worked at WaveRent."


@pytest.mark.django_db
def test_reporting_needs_no_account(api, org, founder):
    """The complaint is about being emailed without one."""
    _, invite = _invite(org, founder)
    res = api.post(
        f"/api/public/team-invites/{invite.token}/report/", {"reason": "unwanted"}, format="json"
    )
    assert res.status_code == 204
    assert TeamInviteReport.objects.count() == 1


@pytest.mark.django_db
def test_a_closed_invite_can_still_be_reported(api, org, founder):
    """Someone may only realise after declining — or read the email weeks late."""
    _, invite = _invite(org, founder)
    decline_team_invite(invite)
    invite.refresh_from_db()
    declined_at = invite.declined_at

    res = api.post(
        f"/api/public/team-invites/{invite.token}/report/",
        {"reason": "impersonation"},
        format="json",
    )
    assert res.status_code == 204
    assert TeamInviteReport.objects.filter(invite=invite).count() == 1

    invite.refresh_from_db()
    # The earlier decline stands; reporting didn't restate it with a new date.
    assert invite.declined_at == declined_at


@pytest.mark.django_db
def test_reporting_an_already_forgotten_invite_files_the_complaint_anyway(api, org, founder):
    """An expired invite has no address left, so there is nothing to block —
    but the objection is still an objection and still needs reading."""
    _, invite = _invite(org, founder)
    TeamInvite.objects.filter(pk=invite.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    expire_invites()

    res = api.post(
        f"/api/public/team-invites/{invite.token}/report/", {"reason": "other"}, format="json"
    )
    assert res.status_code == 204
    assert TeamInviteReport.objects.count() == 1
    assert TeamInviteOptOut.objects.count() == 0


@pytest.mark.django_db
def test_a_report_keeps_no_address(api, org, founder):
    _, invite = _invite(org, founder)
    api.post(
        f"/api/public/team-invites/{invite.token}/report/",
        {"reason": "not_me", "note": "wrong person"},
        format="json",
    )
    report = TeamInviteReport.objects.get()
    assert "ada@example.com" not in f"{report.note}{report.resolution}"
    assert not any(
        field.name for field in TeamInviteReport._meta.get_fields() if field.name == "email"
    )


@pytest.mark.django_db
def test_a_made_up_reason_is_refused(api, org, founder):
    _, invite = _invite(org, founder)
    res = api.post(
        f"/api/public/team-invites/{invite.token}/report/", {"reason": "because"}, format="json"
    )
    assert res.status_code == 400
    assert TeamInviteReport.objects.count() == 0
    invite.refresh_from_db()
    # A rejected report must not half-apply — the invite is untouched.
    assert invite.answer == "open"


@pytest.mark.django_db
def test_reporting_an_unknown_token_is_a_404(api):
    res = api.post("/api/public/team-invites/nope/report/", {"reason": "other"}, format="json")
    assert res.status_code == 404


@pytest.mark.django_db
def test_the_org_cannot_be_invited_again_after_a_report(api, org, founder):
    """The block is the half of the report the org has to feel."""
    _, invite = _invite(org, founder)
    api.post(
        f"/api/public/team-invites/{invite.token}/report/", {"reason": "unwanted"}, format="json"
    )
    mail.outbox.clear()

    api.force_authenticate(founder)
    res = api.post(
        f"/api/orgs/{org.slug}/team-invites/",
        {"email": "Ada@Example.com", "role": "employee", "title": "Engineer"},
        format="json",
    )
    # 201 with no item, as for any opt-out: an opt-out that is reportable back
    # to the org is not an opt-out.
    assert res.status_code == 201
    assert res.json() == {"kind": "invite", "item": None}
    assert mail.outbox == []
    assert TeamInvite.objects.filter(accepted_at__isnull=True, declined_at__isnull=True).count() == 0


@pytest.mark.django_db
def test_resolving_a_report_records_who_did_it(org, founder):
    """What makes the admin screen a queue: resolution is an act, with a name on it."""
    _, invite = _invite(org, founder)
    report = report_team_invite(invite, reason=TeamInviteReport.Reason.NOT_ME)
    assert report.is_pending

    report.resolved_at = timezone.now()
    report.resolved_by = founder
    report.resolution = "Org confirmed the mistake; invite removed."
    report.save()

    report.refresh_from_db()
    assert not report.is_pending
    assert report.resolved_by == founder
