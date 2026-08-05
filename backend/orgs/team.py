"""Serialize org memberships for public and authenticated profile views."""

from .models import OrgMembership


def serialize_team_members(org) -> list[dict]:
    members = (
        OrgMembership.objects.filter(org=org)
        .select_related("user", "user__investorprofile")
        .order_by("role", "id")
    )
    out: list[dict] = []
    for membership in members:
        profile = getattr(membership.user, "investorprofile", None)
        full_name = membership.user.email
        if profile and profile.full_name:
            full_name = profile.full_name
        elif membership.user.get_full_name():
            full_name = membership.user.get_full_name()

        picture = None
        handle = None
        if profile:
            if profile.profile_picture:
                try:
                    picture = profile.profile_picture.url
                except ValueError:
                    pass
            if profile.handle and profile.is_complete:
                handle = profile.handle

        out.append(
            {
                "full_name": full_name,
                "title": membership.title or "",
                "profile_picture": picture,
                "handle": handle,
            }
        )
    return out
