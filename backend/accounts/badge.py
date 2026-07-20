"""Embeddable personal verification badge."""

from django.conf import settings
from django.utils.timezone import now

BEEDERO_YELLOW = "#f9de4a"
BEEDERO_BLACK = "#050604"


def person_badge_state(profile) -> dict:
    return {
        "handle": profile.handle,
        "name": profile.full_name,
        "verified": profile.is_verified,
        "visual_status": "verified" if profile.is_verified else "unverified",
        "as_of": now().date().isoformat(),
    }


def render_person_badge_svg(state: dict) -> str:
    verified = state["verified"]
    palette = (
        {"bg": BEEDERO_YELLOW, "fg": BEEDERO_BLACK, "border": BEEDERO_BLACK, "label": "Verified on Beedero"}
        if verified
        else {"bg": "#F3F4F6", "fg": "#9CA3AF", "border": "#D1D5DB", "label": "Beedero profile"}
    )
    name = _escape_xml((state["name"] or "Profile")[:28])
    label = _escape_xml(palette["label"])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="{label}">
  <rect x="1" y="1" width="218" height="62" rx="12" fill="{palette['bg']}" stroke="{palette['border']}" stroke-width="2"/>
  <text x="16" y="26" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="{palette['fg']}" opacity="0.75">{label}</text>
  <text x="16" y="46" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="{palette['fg']}">{name}</text>
</svg>"""


def person_badge_embed_html(profile) -> dict:
    if not profile.handle:
        return {"html": "", "profile_url": "", "badge_url": "", "json_url": ""}
    site = settings.FRONTEND_URL.rstrip("/")
    handle = profile.handle
    profile_url = f"{site}/p/{handle}"
    badge_url = f"{site}/pbadge/{handle}.svg"
    html = (
        f'<a href="{profile_url}">\n'
        f'  <img src="{badge_url}" alt="Beedero profile" height="48">\n'
        f"</a>"
    )
    return {
        "html": html,
        "profile_url": profile_url,
        "badge_url": badge_url,
        "json_url": f"{site}/pbadge/{handle}.json",
    }


def _escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
