"""Business logic for affiliations — mirrors jobs/services.py's plain-
function, @transaction.atomic-on-writes convention.

The one rule every function here defends: founder status can never become
"verified" via org confirmation — only verify_founder_via_registry (driven
by AffiliationAdmin, after manual certificate review) can do that.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from notifications.models import Notification
from notifications.services import notify
from orgs.models import Organization, OrgMembership

from .models import Affiliation, RoleType

User = get_user_model()


def org_admins(org):
    return User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()


def _mark_affiliation_request_read(affiliation: Affiliation) -> None:
    Notification.objects.filter(
        aggregate_key=f"affiliation_request:{affiliation.id}",
        read_at__isnull=True,
    ).update(read_at=timezone.now())


def _display_name(user) -> str:
    profile = getattr(user, "investorprofile", None)
    if profile and profile.full_name:
        return profile.full_name
    return user.email.split("@", 1)[0]


def _has_active_claim(user, org, role) -> bool:
    return Affiliation.objects.filter(
        user=user, org=org, role=role, ended_on__isnull=True
    ).exclude(status=Affiliation.Status.DISPUTED).exists()


@transaction.atomic
def declare_affiliation(
    user, org, *, role, title="", started_on, ended_on=None, skills=None
) -> Affiliation:
    if org.status != Organization.Status.LIVE:
        raise ValidationError({"org": "Only live organizations can be affiliated with."})
    if _has_active_claim(user, org, role):
        raise ValidationError({"role": "You already have an active claim for this role at this organization."})

    status = Affiliation.Status.SELF_DECLARED if role == RoleType.FOUNDER else Affiliation.Status.PENDING
    affiliation = Affiliation.objects.create(
        user=user,
        org=org,
        role=role,
        title=title,
        started_on=started_on,
        ended_on=ended_on,
        skills=skills or [],
        status=status,
        created_by=user,
    )

    if role != RoleType.FOUNDER:
        person_name = _display_name(user)
        role_label = title or affiliation.get_role_display()
        for admin in org_admins(org):
            notify(
                admin,
                kind=Notification.Kind.AFFILIATION_REQUEST,
                aggregate_key=f"affiliation_request:{affiliation.id}",
                title="Affiliation request",
                body=f"{person_name} declared a {role_label} affiliation with {org.name}.",
                link=f"/dashboard/{org.slug}",
                payload={"affiliation_id": affiliation.id, "can_accept": False},
            )
    return affiliation


@transaction.atomic
def org_add_affiliation(
    admin_user, org, target_user, *, role, title="", started_on, ended_on=None
) -> Affiliation:
    if role == RoleType.FOUNDER:
        raise ValidationError({"role": "Founder status can only be self-declared by the person."})
    if org.status != Organization.Status.LIVE:
        raise ValidationError({"org": "Only live organizations can add affiliations."})
    if _has_active_claim(target_user, org, role):
        raise ValidationError({"role": "This person already has an active claim for this role at this organization."})

    affiliation = Affiliation.objects.create(
        user=target_user,
        org=org,
        role=role,
        title=title,
        started_on=started_on,
        ended_on=ended_on,
        status=Affiliation.Status.PENDING,
        created_by=admin_user,
    )
    role_label = title or affiliation.get_role_display()
    notify(
        target_user,
        kind=Notification.Kind.AFFILIATION_REQUEST,
        aggregate_key=f"affiliation_request:{affiliation.id}",
        title="Affiliation request",
        body=f"{org.name} added you as {role_label}.",
        link="/dashboard",
        payload={"affiliation_id": affiliation.id, "can_accept": True},
    )
    return affiliation


@transaction.atomic
def confirm_affiliation(affiliation: Affiliation, by_admin) -> Affiliation:
    if affiliation.role == RoleType.FOUNDER:
        raise ValidationError({"role": "Founder status cannot be confirmed by the organization."})
    if affiliation.status != Affiliation.Status.PENDING or affiliation.created_by_id != affiliation.user_id:
        raise ValidationError({"status": "Only a person-initiated pending affiliation can be confirmed."})

    affiliation.status = Affiliation.Status.VERIFIED
    affiliation.verified_via = Affiliation.VerifiedVia.ORG
    affiliation.verified_at = timezone.now()
    affiliation.save(update_fields=["status", "verified_via", "verified_at"])
    notify(
        affiliation.user,
        kind=Notification.Kind.AFFILIATION_UPDATE,
        aggregate_key=f"affiliation_update:{affiliation.id}",
        title="Affiliation confirmed",
        body=f"{affiliation.org.name} confirmed your {affiliation.get_role_display()} affiliation.",
        link="/dashboard",
    )
    return affiliation


@transaction.atomic
def dispute_affiliation(affiliation: Affiliation, by_admin) -> Affiliation:
    if affiliation.status != Affiliation.Status.PENDING or affiliation.created_by_id != affiliation.user_id:
        raise ValidationError({"status": "Only a person-initiated pending affiliation can be disputed."})

    affiliation.status = Affiliation.Status.DISPUTED
    affiliation.save(update_fields=["status"])
    notify(
        affiliation.user,
        kind=Notification.Kind.AFFILIATION_UPDATE,
        aggregate_key=f"affiliation_update:{affiliation.id}",
        title="Affiliation disputed",
        body=f"{affiliation.org.name} disputed your {affiliation.get_role_display()} affiliation.",
        link="/dashboard",
    )
    return affiliation


@transaction.atomic
def accept_affiliation(affiliation: Affiliation, by_user) -> Affiliation:
    if affiliation.user_id != by_user.id:
        raise PermissionDenied("This affiliation doesn't belong to you.")
    if affiliation.role == RoleType.FOUNDER:
        raise ValidationError({"role": "Founder status cannot be accepted this way."})
    if affiliation.status != Affiliation.Status.PENDING or affiliation.created_by_id == affiliation.user_id:
        raise ValidationError({"status": "Only an organization-added pending affiliation can be accepted."})

    affiliation.status = Affiliation.Status.VERIFIED
    affiliation.verified_via = Affiliation.VerifiedVia.ORG
    affiliation.verified_at = timezone.now()
    affiliation.save(update_fields=["status", "verified_via", "verified_at"])
    _mark_affiliation_request_read(affiliation)
    return affiliation


@transaction.atomic
def withdraw_affiliation(affiliation: Affiliation, by_user) -> None:
    if affiliation.user_id != by_user.id:
        raise PermissionDenied("This affiliation doesn't belong to you.")
    if affiliation.status == Affiliation.Status.VERIFIED:
        raise ValidationError({"status": "A verified affiliation can't be withdrawn."})
    affiliation_id = affiliation.id
    affiliation.delete()
    Notification.objects.filter(
        user=by_user,
        aggregate_key=f"affiliation_request:{affiliation_id}",
        read_at__isnull=True,
    ).update(read_at=timezone.now())


@transaction.atomic
def verify_founder_via_registry(affiliation: Affiliation, reviewer) -> Affiliation:
    if affiliation.role != RoleType.FOUNDER:
        raise ValidationError({"role": "Only founder claims can be verified via registry."})

    affiliation.status = Affiliation.Status.VERIFIED
    affiliation.verified_via = Affiliation.VerifiedVia.REGISTRY
    affiliation.verified_at = timezone.now()
    affiliation.save(update_fields=["status", "verified_via", "verified_at"])
    notify(
        affiliation.user,
        kind=Notification.Kind.AFFILIATION_UPDATE,
        aggregate_key=f"affiliation_update:{affiliation.id}",
        title="Founder status verified",
        body=f"Your founder status at {affiliation.org.name} was verified via registry certificate.",
        link="/dashboard",
    )
    return affiliation


@transaction.atomic
def dispute_founder(affiliation: Affiliation, reviewer) -> Affiliation:
    if affiliation.role != RoleType.FOUNDER:
        raise ValidationError({"role": "Only founder claims can be disputed this way."})

    affiliation.status = Affiliation.Status.DISPUTED
    affiliation.save(update_fields=["status"])
    notify(
        affiliation.user,
        kind=Notification.Kind.AFFILIATION_UPDATE,
        aggregate_key=f"affiliation_update:{affiliation.id}",
        title="Founder status disputed",
        body=f"Your founder claim at {affiliation.org.name} was disputed after review.",
        link="/dashboard",
    )
    return affiliation
