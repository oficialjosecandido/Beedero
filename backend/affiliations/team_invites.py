"""Inviting one named person to confirm they worked somewhere.

Doc `beedero-aquisicao-pessoas.md` §2 — the cycle it calls "prioridade máxima",
and the one with the sharpest edges, because it is the only place in Beedero
that emails somebody who never asked to hear from us.

Everything in §2.4 and §9 that constrains that is enforced here rather than in
the view, so there is exactly one door:

  - only an org owner/admin can invite (the view's permission class) and the
    invite is always *from* an organisation, never from a person;
  - 20 a day and 50 a week per org, so an org cannot become a mailing list;
  - one invite and at most one reminder, ever, per address per org;
  - every email carries a way to decline and a way to never hear from that org
    again, and an opt-out blocks the invite from being created at all;
  - nothing is ever accepted on someone's behalf. `accept_team_invite` requires
    a signed-in person whose verified address matches the invite.

§2.4 marks the email itself `[REVISÃO LEGAL]` — "confirmar base legal e texto
(um convite + um lembrete, sem marketing)". The copy below is written to that
constraint: it states who added them, to what, and what accepting does, and it
sells nothing. The legal question of whether that is enough is not one this
module can answer, and the marker stays open until someone answers it.
"""

from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape
from rest_framework.exceptions import ValidationError

import sentry_sdk

from accounts.models import User

from .models import Affiliation, RoleType, TeamInvite, TeamInviteOptOut, TeamInviteReport
from .services import org_add_affiliation

MAX_EMAIL_LENGTH = 254


class OptedOut(Exception):
    """This address has asked not to be invited.

    Its own type, not a `ValidationError` with a recognisable message, because
    the caller has to treat it differently from every other refusal — it must
    answer the org as if the invite had been sent (see `OrgTeamInvitesView`) —
    and a guard that depends on matching an error string is a guard that breaks
    the next time someone rewords the string.
    """


def normalize_email(raw) -> str:
    return str(raw or "").strip().lower()[:MAX_EMAIL_LENGTH]


def is_opted_out(email: str, org) -> bool:
    """Has this address asked not to be invited — by this org, or at all?"""
    return TeamInviteOptOut.objects.filter(
        Q(org=org) | Q(org__isnull=True), email=email
    ).exists()


def _quota_left(org) -> tuple[int, int]:
    now = timezone.now()
    sent = TeamInvite.objects.filter(org=org)
    today = sent.filter(created_at__gte=now - timedelta(days=1)).count()
    week = sent.filter(created_at__gte=now - timedelta(days=7)).count()
    return TeamInvite.MAX_PER_DAY - today, TeamInvite.MAX_PER_WEEK - week


def invite_quota(org) -> dict:
    """What the org has left — shown in the UI so the limit is never a surprise."""
    day_left, week_left = _quota_left(org)
    return {
        "per_day": TeamInvite.MAX_PER_DAY,
        "per_week": TeamInvite.MAX_PER_WEEK,
        "remaining_today": max(0, day_left),
        "remaining_this_week": max(0, week_left),
    }


@transaction.atomic
def invite_team_member(
    admin_user, org, *, email, name="", role, title="", started_on=None
):
    """Invite one person to confirm an affiliation with `org`.

    Returns `(kind, object)` where kind is "affiliation" or "invite": an
    address that already has an account does not get an email from us at all,
    it gets the in-app flow that already exists (§2.2 step 2). Only someone
    with no account is emailed, which is the narrowest reading of §2.4 and the
    only one that keeps this from being a growth-hack mailer.
    """
    email = normalize_email(email)
    if not email or "@" not in email:
        raise ValidationError({"email": "Enter a valid email address."})
    if role == RoleType.FOUNDER:
        # Same rule as org_add_affiliation: an organisation cannot hand out
        # founder status, and an invite must not become a way around that.
        raise ValidationError(
            {"role": "Founder status can only be declared by the person themselves."}
        )

    # Someone who already has an account is not a stranger to email — they get
    # a notification and an accept screen inside Beedero, which is the flow
    # affiliations/services.py already implements.
    existing = User.objects.filter(email__iexact=email).first()
    if existing is not None:
        affiliation = org_add_affiliation(
            admin_user,
            org,
            existing,
            role=role,
            title=title,
            started_on=started_on or timezone.now().date(),
        )
        return "affiliation", affiliation

    if is_opted_out(email, org):
        # Deliberately indistinguishable from a successful send in the API's
        # reply (see the view): telling an org "that address blocked you" would
        # turn the opt-out into a disclosure.
        raise OptedOut(email)

    day_left, week_left = _quota_left(org)
    if day_left <= 0:
        raise ValidationError(
            {"email": f"That's {TeamInvite.MAX_PER_DAY} invites today — the daily limit. Try tomorrow."}
        )
    if week_left <= 0:
        raise ValidationError(
            {"email": f"That's {TeamInvite.MAX_PER_WEEK} invites this week — the weekly limit."}
        )

    try:
        invite = TeamInvite.objects.create(
            org=org,
            email=email,
            name=name[:120],
            role=role,
            title=title[:120],
            started_on=started_on,
            invited_by=admin_user,
            expires_at=timezone.now() + timedelta(days=TeamInvite.TTL_DAYS),
        )
    except IntegrityError:
        # uniq_open_team_invite — "add team" clicked twice, or two admins
        # inviting the same person. One open invite means one email.
        raise ValidationError({"email": "This person already has an open invite from your team."})

    # After the row commits, not before: an email about an invite that failed
    # to save is an email about nothing.
    transaction.on_commit(lambda: send_team_invite_email(invite, reminder=False))
    return "invite", invite


@transaction.atomic
def accept_team_invite(invite: TeamInvite, user) -> Affiliation:
    """The person says yes, on a screen built for saying yes or no.

    §9: "Vínculo aceite por convite = consentimento explícito da pessoa (ecrã
    de aceitar/recusar)". Both halves are enforced here — the invite is only
    acceptable by the address it was sent to, and only by a request the person
    made themselves.
    """
    invite = TeamInvite.objects.select_for_update().get(pk=invite.pk)
    if not invite.is_open:
        raise ValidationError({"detail": "This invite is no longer open."})
    if normalize_email(user.email) != invite.email:
        # The org named one address. Accepting from another would let anyone
        # holding the link mint a verified affiliation for themselves.
        raise ValidationError(
            {"detail": "This invite was sent to a different email address."}
        )

    affiliation = Affiliation.objects.create(
        user=user,
        org=invite.org,
        role=invite.role,
        title=invite.title,
        started_on=invite.started_on or invite.created_at.date(),
        # Verified in one step because both parties have now spoken: the org
        # wrote the invite naming this person, and this person accepted it.
        status=Affiliation.Status.VERIFIED,
        verified_via=Affiliation.VerifiedVia.ORG,
        verified_at=timezone.now(),
        created_by=invite.invited_by or user,
    )

    invite.accepted_at = timezone.now()
    # The address has done its job; §2.2 says it does not outlive the invite.
    invite.email = ""
    invite.save(update_fields=["accepted_at", "email"])

    # §8.2: "Um convite de equipa aceite define signup_source='invite'".
    # Only if nothing claimed it first — someone who arrived from a job ad and
    # happened to also have an invite came from the job ad.
    if not user.signup_source:
        user.signup_source = "invite"
        user.signup_ref = f"invite:{invite.org.slug}"
        user.save(update_fields=["signup_source", "signup_ref"])

    return affiliation


@transaction.atomic
def decline_team_invite(invite: TeamInvite, *, block: bool = False) -> None:
    """No thanks — optionally, and never again from this org.

    Authorised by the token alone, with no session: the whole point is that
    refusing must be easier than accepting, and requiring someone to create an
    account in order to say no would be the opposite of consent.
    """
    invite = TeamInvite.objects.select_for_update().get(pk=invite.pk)
    email = invite.email
    if invite.is_open:
        invite.declined_at = timezone.now()
        invite.email = ""
        invite.save(update_fields=["declined_at", "email"])

    if block and email:
        TeamInviteOptOut.objects.get_or_create(email=email, org=invite.org)


@transaction.atomic
def report_team_invite(invite: TeamInvite, *, reason: str, note: str = "") -> TeamInviteReport:
    """A denúncia: a stronger "no" than declining, and one a human has to read.

    Reporting does three things at once, because someone telling us an invite
    should not have reached them means all three:

      1. the invite is declined, if it is still open;
      2. that org is blocked from inviting this address again;
      3. a row is filed for an admin to resolve by hand.

    Accepted on a closed invite as well as an open one. Someone may open the
    email weeks later, or only realise after declining that the invite was
    somebody impersonating them — refusing the complaint because the invite is
    already settled would be refusing the part that matters.

    The block has to be read off the invite before `decline_team_invite` runs,
    since declining clears the address. Still inside one transaction: a report
    that recorded the complaint but lost the block would be the worst of the
    three outcomes.
    """
    email = TeamInvite.objects.values_list("email", flat=True).get(pk=invite.pk)
    decline_team_invite(invite, block=False)
    if email:
        TeamInviteOptOut.objects.get_or_create(email=email, org_id=invite.org_id)
    return TeamInviteReport.objects.create(
        invite=invite,
        org_id=invite.org_id,
        reason=reason,
        note=(note or "").strip()[:2000],
    )


def expire_invites() -> int:
    """Close out invites past their 30 days and forget the addresses."""
    stale = TeamInvite.objects.filter(
        expires_at__lte=timezone.now(),
        accepted_at__isnull=True,
        declined_at__isnull=True,
        expired_at__isnull=True,
    )
    return stale.update(expired_at=timezone.now(), email="")


# --- the email ---------------------------------------------------------------


def _frontend(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _role_phrase(invite: TeamInvite) -> str:
    return invite.title or invite.get_role_display().lower()


def _compose(invite: TeamInvite, *, reminder: bool) -> tuple[str, str, str]:
    org = invite.org.name
    who = invite.name or "there"
    role = _role_phrase(invite)
    link = _frontend(f"/invite/team/{invite.token}")
    decline = _frontend(f"/invite/team/{invite.token}?answer=no")

    subject = (
        f"Reminder: {org} added you to their team on Beedero"
        if reminder
        else f"{org} added you to their team on Beedero"
    )

    opening = (
        f"A few days ago {org} added you to their team on Beedero and you "
        "haven't answered yet. This is the only reminder we'll send."
        if reminder
        else f"{org} added you to their team on Beedero as {role}."
    )

    text = (
        f"Hi {who},\n\n"
        f"{opening}\n\n"
        "Beedero is where startups and the people who build them keep a record "
        "that someone else can vouch for. If you confirm, your time at "
        f"{org} becomes a verified fact on your profile — confirmed by them, "
        "not just claimed by you.\n\n"
        f"Confirm or decline:\n{link}\n\n"
        "Nothing is added to any profile until you say yes. If this isn't you, "
        f"or you'd rather not, you can decline here:\n{decline}\n\n"
        "That page also has a button to stop any further invites from "
        f"{org}.\n\n"
        "— Beedero\n"
    )

    html = (
        '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;'
        'font-size:15px;line-height:1.55;color:#050604">'
        f"<p>Hi {escape(who)},</p>"
        f"<p>{escape(opening)}</p>"
        "<p>Beedero is where startups and the people who build them keep a "
        "record that someone else can vouch for. If you confirm, your time at "
        f"{escape(org)} becomes a verified fact on your profile — confirmed by "
        "them, not just claimed by you.</p>"
        f'<p><a href="{escape(link)}" '
        'style="display:inline-block;padding:12px 22px;border-radius:9999px;'
        "background:#050604;color:#f9de4a;font-weight:700;text-decoration:none\">"
        "Confirm or decline</a></p>"
        '<p style="color:#52525b;font-size:13px">Nothing is added to any profile '
        "until you say yes. If this isn't you, or you'd rather not, "
        f'<a href="{escape(decline)}">decline here</a> — that page also has a '
        f"button to stop any further invites from {escape(org)}.</p>"
        "<p>— Beedero</p>"
        "</div>"
    )
    return subject, text, html


def send_team_invite_email(invite: TeamInvite, *, reminder: bool) -> bool:
    """Send it. Never raises — a mail hiccup must not undo an invite row."""
    if not invite.email:
        return False
    subject, text, html = _compose(invite, reminder=reminder)
    message = EmailMultiAlternatives(
        subject, text, settings.DEFAULT_FROM_EMAIL, [invite.email]
    )
    message.attach_alternative(html, "text/html")
    try:
        message.send()
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return False
    return True


def send_due_reminders() -> int:
    """One reminder, after three days, only if there's been no answer (§2.4)."""
    due = TeamInvite.objects.filter(
        reminded_at__isnull=True,
        accepted_at__isnull=True,
        declined_at__isnull=True,
        expired_at__isnull=True,
        expires_at__gt=timezone.now(),
        created_at__lte=timezone.now() - timedelta(days=TeamInvite.REMINDER_AFTER_DAYS),
    ).select_related("org")

    sent = 0
    for invite in due:
        # Stamped whether or not the send succeeds. A retry loop on a bouncing
        # address is how "one reminder" quietly becomes several.
        invite.reminded_at = timezone.now()
        invite.save(update_fields=["reminded_at"])
        if send_team_invite_email(invite, reminder=True):
            sent += 1
    return sent
