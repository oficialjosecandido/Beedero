"""Automatic public handles for investor profiles (/p/<handle>)."""

from django.utils.text import slugify

from .models import InvestorProfile
from .serializers import HANDLE_RE

MAX_HANDLE_BASE = 45


def _valid_handle(candidate: str) -> bool:
    return bool(candidate and HANDLE_RE.match(candidate))


def person_handle_base(profile) -> str:
    if profile.full_name:
        base = slugify(profile.full_name)[:MAX_HANDLE_BASE]
        if _valid_handle(base):
            return base

    email = (profile.user.email or "").strip()
    if "@" in email:
        base = slugify(email.split("@", 1)[0])[:MAX_HANDLE_BASE]
        if _valid_handle(base):
            return base

    return f"user-{profile.user_id}"


def unique_person_handle(profile) -> str:
    base = person_handle_base(profile)
    if not _valid_handle(base):
        base = f"user-{profile.user_id}"

    slug = base
    suffix = 2
    while InvestorProfile.objects.filter(handle=slug).exclude(pk=profile.pk).exists():
        stem = base[: max(1, MAX_HANDLE_BASE - len(str(suffix)) - 1)]
        slug = f"{stem}-{suffix}"
        suffix += 1
    return slug


def ensure_profile_handle(profile, *, save: bool = True, allow_email_fallback: bool = False) -> bool:
    if profile.handle:
        return False
    if not profile.full_name and not (allow_email_fallback and profile.user.email):
        return False
    profile.handle = unique_person_handle(profile)
    if save:
        profile.save(update_fields=["handle"])
    return True
