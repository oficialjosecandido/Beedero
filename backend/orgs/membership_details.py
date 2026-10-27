"""Person-side edits to roster title/dates/description/skills — demote verification until org confirms."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from django.utils import timezone

from accounts.skills import normalize_skills
from notifications.models import Notification
from notifications.services import notify

from .models import MembershipSkill, OrgMembership

User = get_user_model()

MEMBERSHIP_SKILLS_CAP = 10
DESCRIPTION_MAX = 500


def org_admins(org):
    return User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]


def sync_membership_skills(membership: OrgMembership, skills: list[str] | None) -> None:
    """Replace the member's declared skill list while preserving confirmations on kept names."""
    if skills is None:
        return
    desired = normalize_skills(skills)[:MEMBERSHIP_SKILLS_CAP]
    existing = {row.skill.lower(): row for row in membership.skills_used.all()}
    desired_keys = {skill.lower() for skill in desired}
    for key, row in list(existing.items()):
        if key not in desired_keys:
            row.delete()
    for skill in desired:
        if skill.lower() not in existing:
            MembershipSkill.objects.create(membership=membership, skill=skill)


@transaction.atomic
def member_update_details(
    membership: OrgMembership,
    by_user,
    *,
    title,
    started_on,
    ended_on,
    description="",
    skills=None,
) -> OrgMembership:
    """Apply the member's own title/date/description edits and park details as pending.

    Org admins are notified (including the editor when they are an admin) so
    the pending confirmation is visible on the Team tab. Skills sync in the
    same save without requiring a separate request.
    """
    if membership.user_id != by_user.id:
        raise PermissionDenied("You can only edit your own team record.")

    membership.title = (title or "")[:120]
    membership.description = str(description or "").strip()[:DESCRIPTION_MAX]
    membership.started_on = started_on
    membership.ended_on = ended_on
    membership.details_status = OrgMembership.DetailsStatus.PENDING
    # The old attestation was for the old details; it does not carry over.
    membership.details_confirmed_by = None
    membership.details_confirmed_at = None
    membership.save(
        update_fields=[
            "title",
            "description",
            "started_on",
            "ended_on",
            "details_status",
            "details_confirmed_by",
            "details_confirmed_at",
        ]
    )
    sync_membership_skills(membership, skills)

    person_name = _display_name(by_user)
    role_label = membership.title or membership.get_role_display()
    for admin in org_admins(membership.org):
        notify(
            admin,
            kind=Notification.Kind.AFFILIATION_REQUEST,
            aggregate_key=f"membership_details:{membership.id}",
            title="Team details need confirmation",
            body=(
                f"{person_name} updated their {role_label} details at {membership.org.name}. "
                "Confirm to restore the verified badge."
            ),
            link=f"/dashboard/{membership.org.slug}",
            payload={
                "membership_id": membership.id,
                "org_slug": membership.org.slug,
                "can_accept": True,
            },
        )
    return membership


@transaction.atomic
def confirm_membership_details(membership: OrgMembership, by_admin) -> OrgMembership:
    admins = org_admins(membership.org)
    if not admins.filter(id=by_admin.id).exists():
        raise PermissionDenied("Only organisation admins can confirm team details.")
    if membership.details_status != OrgMembership.DetailsStatus.PENDING:
        raise ValidationError({"status": "Only pending team details can be confirmed."})

    membership.details_status = OrgMembership.DetailsStatus.CONFIRMED
    membership.details_confirmed_by = by_admin
    membership.details_confirmed_at = timezone.now()
    membership.save(
        update_fields=["details_status", "details_confirmed_by", "details_confirmed_at"]
    )
    Notification.objects.filter(
        aggregate_key=f"membership_details:{membership.id}",
        read_at__isnull=True,
    ).update(read_at=timezone.now())
    notify(
        membership.user,
        kind=Notification.Kind.AFFILIATION_UPDATE,
        aggregate_key=f"membership_details_confirmed:{membership.id}",
        title="Team details confirmed",
        body=f"{membership.org.name} confirmed your role details. Your verified badge is back.",
        link="/profile",
    )
    return membership
