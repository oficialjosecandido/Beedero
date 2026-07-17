"""Embeddable badge — live mirror of org credibility (doc: selo como prova de vida)."""

from django.conf import settings
from django.utils.timezone import now

from orgs.models import Organization

from .levels import credibility_level
from .models import Verification

BEEDERO_YELLOW = "#f9de4a"
BEEDERO_BLACK = "#050604"

LEVEL_LAYER_LABELS = {
    1: "Identity",
    2: "Compliance",
    3: "Certified financials",
    4: "Real-time traction",
}


def earliest_expiry(org) -> str | None:
    row = (
        org.verifications.filter(
            status=Verification.Status.VERIFIED,
            valid_until__isnull=False,
        )
        .order_by("valid_until")
        .values_list("valid_until", flat=True)
        .first()
    )
    return row.isoformat() if row else None


def _days_until_expiry(org) -> int | None:
    expiry = (
        org.verifications.filter(
            status=Verification.Status.VERIFIED,
            valid_until__isnull=False,
        )
        .order_by("valid_until")
        .values_list("valid_until", flat=True)
        .first()
    )
    if not expiry:
        return None
    return (expiry.date() - now().date()).days


def badge_visual_status(org) -> str:
    """verified | expiring | expired | unverified — drives SVG colours."""
    level = credibility_level(org)
    if level == 0:
        return "expired" if org.verifications.filter(status=Verification.Status.EXPIRED).exists() else "unverified"
    days = _days_until_expiry(org)
    if days is not None and days <= 0:
        return "expired"
    if days is not None and days <= 30:
        return "expiring"
    return "verified"


def verified_layers(org) -> list[dict]:
    """Public summary of which ladder layers are currently satisfied."""
    level = credibility_level(org)
    layers = []
    for rung in (1, 2, 3, 4):
        layers.append(
            {
                "level": rung,
                "label": LEVEL_LAYER_LABELS[rung],
                "verified": level >= rung,
            }
        )
    return layers


def badge_state(org) -> dict:
    level = credibility_level(org)
    expiry = earliest_expiry(org)
    visual = badge_visual_status(org)
    return {
        "org": org.slug,
        "name": org.name,
        "logo": org.logo.url if org.logo else None,
        "level": level,
        "verified": level >= 1 and visual in ("verified", "expiring"),
        "visual_status": visual,
        "valid_until": expiry,
        "days_until_expiry": _days_until_expiry(org),
        "layers": verified_layers(org),
        "as_of": now().date().isoformat(),
    }


def get_live_org(slug: str) -> Organization:
    return Organization.objects.get(slug=slug, status=Organization.Status.LIVE)


def render_badge_svg(state: dict) -> str:
    visual = state["visual_status"]
    palette = {
        "verified": {"bg": BEEDERO_YELLOW, "fg": BEEDERO_BLACK, "border": BEEDERO_BLACK, "label": "Verified on Beedero"},
        "expiring": {"bg": "#FEF3C7", "fg": "#92400E", "border": "#D97706", "label": "Expiring soon"},
        "expired": {"bg": "#E5E7EB", "fg": "#6B7280", "border": "#9CA3AF", "label": "Verification expired"},
        "unverified": {"bg": "#F3F4F6", "fg": "#9CA3AF", "border": "#D1D5DB", "label": "Not verified"},
    }[visual]
    level = state["level"]
    level_line = f"Level {level}" if level else "No level"
    name = _escape_xml(state["name"][:28])
    label = _escape_xml(palette["label"])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="{label}">
  <rect x="1" y="1" width="218" height="62" rx="12" fill="{palette['bg']}" stroke="{palette['border']}" stroke-width="2"/>
  <text x="16" y="26" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="{palette['fg']}" opacity="0.75">{label}</text>
  <text x="16" y="46" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="{palette['fg']}">{name}</text>
  <text x="204" y="46" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="{palette['fg']}">{_escape_xml(level_line)}</text>
</svg>"""


def _escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def badge_embed_html(org) -> dict:
    site = settings.FRONTEND_URL.rstrip("/")
    slug = org.slug
    verify_url = f"{site}/verify/{slug}"
    badge_url = f"{site}/badge/{slug}.svg"
    html = (
        f'<a href="{verify_url}">\n'
        f'  <img src="{badge_url}" alt="Verified on Beedero" height="48">\n'
        f"</a>"
    )
    return {
        "html": html,
        "verify_url": verify_url,
        "badge_url": badge_url,
        "json_url": f"{site}/badge/{slug}.json",
    }
