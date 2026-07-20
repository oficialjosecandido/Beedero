"""Instagram-style public IDs: Jose Candido → josecandido, shown as @josecandido.

Used for investor profiles (`InvestorProfile.handle`) and organizations
(`Organization.slug`) in one shared namespace.
"""

import re

from django.utils.text import slugify

HANDLE_RE = re.compile(r"^[a-z0-9]{1,50}$")
MAX_HANDLE_BASE = 45


def compact_handle_base(text: str) -> str:
    """Strip to lowercase letters and digits — Jose Candido → josecandido."""
    if not text:
        return ""
    # slugify transliterates accents (Júlio → julio) before we drop separators
    return slugify(text).replace("-", "")[:MAX_HANDLE_BASE]


def valid_handle(candidate: str) -> bool:
    return bool(candidate and HANDLE_RE.match(candidate))


def public_id_taken(
    candidate: str,
    *,
    exclude_profile_pk=None,
    exclude_org_pk=None,
) -> bool:
    from accounts.models import InvestorProfile
    from orgs.models import Organization

    profile_qs = InvestorProfile.objects.filter(handle=candidate)
    org_qs = Organization.objects.filter(slug=candidate)
    if exclude_profile_pk is not None:
        profile_qs = profile_qs.exclude(pk=exclude_profile_pk)
    if exclude_org_pk is not None:
        org_qs = org_qs.exclude(pk=exclude_org_pk)
    return profile_qs.exists() or org_qs.exists()


def unique_public_id(
    base: str,
    *,
    exclude_profile_pk=None,
    exclude_org_pk=None,
    fallback: str | None = None,
) -> str:
    if not valid_handle(base):
        base = fallback or "user"
    if not valid_handle(base):
        raise ValueError(f"Invalid handle fallback: {base!r}")

    candidate = base
    suffix = 2
    while public_id_taken(
        candidate,
        exclude_profile_pk=exclude_profile_pk,
        exclude_org_pk=exclude_org_pk,
    ):
        stem_len = max(1, MAX_HANDLE_BASE - len(str(suffix)))
        candidate = f"{base[:stem_len]}{suffix}"
        suffix += 1
    return candidate
