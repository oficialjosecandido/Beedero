from rest_framework import serializers

from orgs.serializers import _org_summary

from .models import Affiliation, RoleType, TeamInviteReport


class AffiliationDeclareSerializer(serializers.Serializer):
    org_slug = serializers.SlugField()
    role = serializers.ChoiceField(choices=RoleType.choices)
    title = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    started_on = serializers.DateField()
    ended_on = serializers.DateField(required=False, allow_null=True, default=None)
    skills = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class AffiliationAddSerializer(serializers.Serializer):
    handle = serializers.SlugField()
    role = serializers.ChoiceField(choices=RoleType.choices)
    title = serializers.CharField(max_length=100, required=True, allow_blank=False)
    started_on = serializers.DateField()
    ended_on = serializers.DateField(required=False, allow_null=True, default=None)


def _person_summary(user) -> dict:
    profile = getattr(user, "investorprofile", None)
    return {
        "id": user.id,
        "name": profile.full_name if profile else user.email.split("@", 1)[0],
        "headline": profile.headline if profile else "",
        "handle": profile.handle if profile else "",
        "is_verified": bool(profile and profile.is_verified),
        "profile_picture": profile.profile_picture.url if profile and profile.profile_picture else None,
    }


def affiliation_summary(affiliation: Affiliation) -> dict:
    return {
        "id": affiliation.id,
        "org": _org_summary(affiliation.org),
        "person": _person_summary(affiliation.user),
        "role": affiliation.role,
        "title": affiliation.title,
        "started_on": affiliation.started_on.isoformat(),
        "ended_on": affiliation.ended_on.isoformat() if affiliation.ended_on else None,
        "skills": affiliation.skills,
        "status": affiliation.status,
        "verified_via": affiliation.verified_via or None,
        "verified_at": affiliation.verified_at.isoformat() if affiliation.verified_at else None,
        "is_org_added": affiliation.created_by_id != affiliation.user_id,
        "created_at": affiliation.created_at.isoformat(),
    }


class TeamInviteCreateSerializer(serializers.Serializer):
    """The "Quem faz parte da equipa?" form (§2.2 step 1, §2.3).

    `started_on` is optional here where AffiliationAddSerializer requires it:
    the person being invited knows when they joined and the founder filling
    this in may not, and a required field they'd have to guess at is a field
    that gets guessed at. Accepting leaves it to be confirmed, and when it is
    missing the invite's own date stands in.
    """

    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    # Founder is excluded at the service layer too — an org cannot hand out
    # founder status, and an invite must not be the way around that.
    role = serializers.ChoiceField(choices=RoleType.choices)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    started_on = serializers.DateField(required=False, allow_null=True, default=None)


class TeamInviteDeclineSerializer(serializers.Serializer):
    """Declining and blocking are separate intentions, so blocking is opt-in."""

    block = serializers.BooleanField(required=False, default=False)


class TeamInviteReportSerializer(serializers.Serializer):
    """A complaint about having been invited at all.

    The note is optional and free text: someone reporting an invite is rarely
    in the mood to pick from a list, and the four reasons exist to route the
    report, not to make them justify it.
    """

    reason = serializers.ChoiceField(choices=TeamInviteReport.Reason.choices)
    note = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )


def mask_email(email: str) -> str:
    """`josevcandido@gmail.com` → `jo…do@gmail.com`.

    The invite link is a bearer token sitting in an inbox, and anyone who finds
    it can load the preview. Showing the full address there would make a leaked
    link an address disclosure; showing nothing would leave the person unable
    to tell which of their addresses to sign in with. This shows enough to
    recognise and not enough to harvest.
    """
    local, _, domain = email.partition("@")
    if not domain:
        return ""
    if len(local) <= 4:
        return f"{local[:1]}…@{domain}"
    return f"{local[:2]}…{local[-2:]}@{domain}"


def team_invite_summary(invite) -> dict:
    """What the org's team tab sees — the address included, because the org
    typed it in and already knows it."""
    return {
        "id": invite.id,
        "email": invite.email,
        "name": invite.name,
        "role": invite.role,
        "role_label": invite.get_role_display(),
        "title": invite.title,
        "started_on": invite.started_on.isoformat() if invite.started_on else None,
        "answer": invite.answer,
        "created_at": invite.created_at.isoformat(),
        "reminded_at": invite.reminded_at.isoformat() if invite.reminded_at else None,
        "expires_at": invite.expires_at.isoformat(),
    }


def team_invite_public(invite) -> dict:
    """What the person opening the link sees, before any sign-in.

    Only what they need in order to decide: who is asking, for what, and which
    address it was sent to. No invite ids, no org internals, and the address
    masked — see `mask_email`.
    """
    return {
        "org": _org_summary(invite.org),
        "name": invite.name,
        "role": invite.role,
        "role_label": invite.get_role_display(),
        "title": invite.title,
        "started_on": invite.started_on.isoformat() if invite.started_on else None,
        "invited_by": _person_summary(invite.invited_by)["name"] if invite.invited_by else "",
        "email_hint": mask_email(invite.email),
        "answer": invite.answer,
        "expires_at": invite.expires_at.isoformat(),
    }
