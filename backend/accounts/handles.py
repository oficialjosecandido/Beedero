"""Automatic public handles for investor profiles (/p/<handle>)."""

from beedero.handles import MAX_HANDLE_BASE, compact_handle_base, unique_public_id, valid_handle

from .models import InvestorProfile


def person_handle_base(profile) -> str:
    if profile.full_name:
        base = compact_handle_base(profile.full_name)
        if valid_handle(base):
            return base

    email = (profile.user.email or "").strip()
    if "@" in email:
        base = compact_handle_base(email.split("@", 1)[0])
        if valid_handle(base):
            return base

    return f"user{profile.user_id}"


def unique_person_handle(profile) -> str:
    base = person_handle_base(profile)
    fallback = f"user{profile.user_id}"
    return unique_public_id(
        base,
        exclude_profile_pk=profile.pk,
        fallback=fallback,
    )


def ensure_profile_handle(profile, *, save: bool = True, allow_email_fallback: bool = False) -> bool:
    if profile.handle:
        return False
    if not profile.full_name and not (allow_email_fallback and profile.user.email):
        return False
    profile.handle = unique_person_handle(profile)
    if save:
        profile.save(update_fields=["handle"])
    return True
