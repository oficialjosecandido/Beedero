"""Shared Beedero branding for outbound HTML emails.

Plain text stays the source of truth for deliverability; this wrapper only
dresses the HTML alternative so digests look like the product instead of a
raw notification. Inline styles only — most clients strip <style> blocks.
"""

from __future__ import annotations

from django.conf import settings
from django.utils.html import escape

YELLOW = "#f9de4a"
INK = "#050604"
BG = "#111319"
SURFACE = "#15181f"
MUTED = "#6b7280"
CARD = "#ffffff"


def frontend_url(path: str = "") -> str:
    base = (getattr(settings, "FRONTEND_URL", None) or "https://beedero.com").rstrip("/")
    if not path:
        return base
    return f"{base}/{path.lstrip('/')}"


def cta_button(label: str, href: str) -> str:
    return (
        f'<a href="{escape(href)}" '
        f'style="display:inline-block;padding:12px 22px;background:{YELLOW};'
        f"color:{INK};font-weight:800;font-size:13px;text-decoration:none;"
        f'letter-spacing:0.02em">{escape(label)}</a>'
    )


def wrap_email(
    *,
    eyebrow: str,
    title: str,
    body_html: str,
    cta_label: str | None = None,
    cta_href: str | None = None,
    footer_html: str = "",
    pixel_url: str | None = None,
) -> str:
    """Frame content with the Beedero wordmark header and dark footer."""
    site = frontend_url()
    cta = ""
    if cta_label and cta_href:
        cta = f'<p style="margin:28px 0 8px">{cta_button(cta_label, cta_href)}</p>'

    pixel = ""
    if pixel_url:
        pixel = (
            f'<img src="{escape(pixel_url)}" width="1" height="1" alt="" '
            f'style="display:block;width:1px;height:1px;border:0">'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e8e8e4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8e4;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:{CARD};border:1px solid #d4d4d0">
        <tr>
          <td style="background:{BG};padding:22px 28px">
            <a href="{escape(site)}" style="text-decoration:none;color:#f4f4f1;font-size:22px;font-weight:900;letter-spacing:-0.04em;text-transform:uppercase">
              beedero<span style="color:{YELLOW}">.</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px">
            <p style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:{MUTED}">
              {escape(eyebrow)}
            </p>
            <h1 style="margin:0 0 20px;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.03em;color:{INK}">
              {escape(title)}
            </h1>
            <div style="font-size:15px;line-height:1.55;color:{INK}">
              {body_html}
            </div>
            {cta}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;font-size:12px;line-height:1.5;color:{MUTED}">
            {footer_html}
            <p style="margin:16px 0 0">
              <a href="{escape(site)}" style="color:{MUTED};text-decoration:underline">beedero.com</a>
            </p>
          </td>
        </tr>
      </table>
      {pixel}
    </td></tr>
  </table>
</body>
</html>"""


def stat_rows(rows: list[tuple[str, str | int]]) -> str:
    """Dark-panel metric rows used in digests."""
    items = "".join(
        f'<tr>'
        f'<td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);'
        f'font-size:13px;color:rgba(255,255,255,0.55)">{escape(label)}</td>'
        f'<td align="right" style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);'
        f'font-size:18px;font-weight:900;color:#f4f4f1;letter-spacing:-0.03em">{escape(str(value))}</td>'
        f"</tr>"
        for label, value in rows
    )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{SURFACE};border:1px solid rgba(255,255,255,0.1);margin:0 0 20px">'
        f"{items}</table>"
    )


def suggestion_block(text: str) -> str:
    return (
        f'<div style="border-left:3px solid {YELLOW};padding:10px 0 10px 14px;'
        f'margin:0 0 8px;background:#fffdf0">'
        f'<p style="margin:0 0 4px;font-size:10px;font-weight:800;letter-spacing:0.14em;'
        f'text-transform:uppercase;color:{MUTED}">Suggestion</p>'
        f'<p style="margin:0;font-size:14px;line-height:1.5;color:{INK}">{escape(text)}</p>'
        f"</div>"
    )


def unsubscribe_link(url: str, label: str = "Unsubscribe from this weekly digest") -> str:
    return (
        f'<p style="margin:0">'
        f'<a href="{escape(url)}" style="color:{MUTED};text-decoration:underline">{escape(label)}</a>'
        f"</p>"
    )
