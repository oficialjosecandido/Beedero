"""The newsletter body: a small Markdown, rendered into the branded email.

Deliberately tiny — what a monthly update needs and nothing that can break
an email client: paragraphs, `## headings`, `- lists`, `**bold**` and
`[links](https://…)`. Everything is HTML-escaped first, so whatever is typed
is shown as text; only those five shapes become markup, and links must be
http(s) or mailto.
"""

import re
from html import escape

from beedero.email_brand import frontend_url, wrap_email

P_STYLE = "margin:0 0 16px;font-size:15px;line-height:1.6"
H_STYLE = "margin:24px 0 8px;font-size:18px;line-height:1.3;font-weight:700"
UL_STYLE = "margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6"
A_STYLE = "color:#050604;font-weight:700;text-decoration:underline"

_BOLD = re.compile(r"\*\*(.+?)\*\*")
_LINK = re.compile(r"\[([^\]]+)\]\(((?:https?://|mailto:)[^)\s]+)\)")


def _inline(text: str) -> str:
    html = escape(text, quote=True)
    html = _BOLD.sub(r"<strong>\1</strong>", html)
    return _LINK.sub(lambda m: f'<a href="{m.group(2)}" style="{A_STYLE}">{m.group(1)}</a>', html)


def render_markdown(source: str) -> str:
    blocks = [b.strip("\n") for b in re.split(r"\n\s*\n", (source or "").replace("\r\n", "\n"))]
    out = []
    for block in blocks:
        if not block.strip():
            continue
        lines = block.split("\n")
        if all(line.lstrip().startswith("- ") for line in lines):
            items = "".join(f"<li>{_inline(line.lstrip()[2:])}</li>" for line in lines)
            out.append(f'<ul style="{UL_STYLE}">{items}</ul>')
        elif len(lines) == 1 and block.startswith("## "):
            out.append(f'<h2 style="{H_STYLE}">{_inline(block[3:])}</h2>')
        else:
            out.append(f'<p style="{P_STYLE}">{"<br>".join(_inline(line) for line in lines)}</p>')
    return "\n".join(out)


def footer_for(kind: str, unsubscribe_url: str | None) -> str:
    style = "margin:0;font-size:12px;line-height:1.6;color:#8a8a8a"
    link_style = "color:#8a8a8a;text-decoration:underline"
    if kind == "announcement":
        return (
            f'<p style="{style}">You are receiving this because you have a Beedero account. '
            "It is a service announcement — a change to how Beedero works — not marketing.</p>"
        )
    prefs = (
        f'<a href="{escape(frontend_url("profile#email-preferences"))}" style="{link_style}">'
        "Manage preferences</a>"
    )
    parts = []
    if unsubscribe_url:
        parts.append(f'<a href="{escape(unsubscribe_url)}" style="{link_style}">Unsubscribe</a>')
    parts.append(prefs)
    return (
        f'<p style="{style}">You are receiving the Beedero newsletter because you asked for it. '
        f'{" · ".join(parts)}</p>'
    )


def newsletter_html(*, kind: str, subject: str, body: str, unsubscribe_url: str | None = None) -> str:
    return wrap_email(
        eyebrow="Service announcement" if kind == "announcement" else "Newsletter",
        title=subject,
        body_html=render_markdown(body),
        footer_html=footer_for(kind, unsubscribe_url),
    )
