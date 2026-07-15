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

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString(LOCALE)}`;
}
