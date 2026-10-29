from .models import NexusAction


def record(actor, action: str, *, target_type: str = "", target_id="", label: str = "", reason: str = "", **data):
    return NexusAction.objects.create(
        actor=actor,
        actor_email=getattr(actor, "email", "") or "",
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        target_label=(label or "")[:200],
        reason=(reason or "")[:300],
        data=data,
    )


def history(target_type: str, target_id, limit: int = 20) -> list[dict]:
    rows = NexusAction.objects.filter(target_type=target_type, target_id=str(target_id))[:limit]
    return [serialize(row) for row in rows]


def serialize(row: NexusAction) -> dict:
    return {
        "id": row.id,
        "action": row.action,
        "action_label": row.get_action_display(),
        "actor": row.actor_email,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "target_label": row.target_label,
        "reason": row.reason,
        "data": row.data,
        "created_at": row.created_at.isoformat(),
    }
