"""Small helpers shared by the Nexus views."""

from rest_framework.exceptions import ValidationError

PAGE_SIZE = 50


def paginate(queryset, request, page_size: int = PAGE_SIZE) -> tuple[list, dict]:
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    total = queryset.count()
    start = (page - 1) * page_size
    rows = list(queryset[start : start + page_size])
    return rows, {"page": page, "page_size": page_size, "total": total, "pages": max(1, -(-total // page_size))}


def iso(value) -> str | None:
    return value.isoformat() if value else None


def file_url(field) -> str | None:
    try:
        return field.url if field else None
    except ValueError:
        return None


def person(user) -> dict | None:
    if user is None:
        return None
    profile = getattr(user, "investorprofile", None)
    return {
        "id": user.id,
        "name": (profile.full_name if profile and profile.full_name else "") or user.email,
        "email": user.email,
        "handle": profile.handle if profile else None,
        "avatar": file_url(profile.profile_picture) if profile else None,
    }


def required_reason(request, field: str = "reason", max_length: int = 300) -> str:
    reason = (request.data.get(field) or "").strip()
    if not reason:
        raise ValidationError({field: ["Say why — it goes in the audit log."]})
    return reason[:max_length]
