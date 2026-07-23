// `toLocaleDateString()`/`toLocaleString()` without an explicit locale resolve
// to the runtime's default locale, which differs between the Node server
// (follows the request's Accept-Language) and the browser (follows the
// user's OS/browser locale) — e.g. server "15/07/2026" vs. client "7/15/2026"
// for the same Date. That mismatch is a React hydration error. Pinning an
// explicit locale makes server and client always render the same string.
const LOCALE = "en-GB";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString(LOCALE)}`;
}

/** Compact relative time for sidebar lists — e.g. "2h ago", "3d ago". */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Short timestamp for messaging lists — time today, date otherwise. */
export function formatMessageTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
