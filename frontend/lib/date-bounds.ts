/** Shared bounds for every biographical / historical date input. */
export const DATE_YEAR_MIN = 1950;
export const DATE_INPUT_MIN = "1950-01-01";

/** Local calendar date as `YYYY-MM-DD` (what `<input type="date">` expects). */
export function todayDateInputValue(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local datetime as `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function todayDateTimeLocalValue(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export const DATETIME_LOCAL_MIN = `${DATE_INPUT_MIN}T00:00`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns an error message when `value` is outside [1950-01-01, today],
 * or null when empty/valid. Empty is allowed — callers enforce `required`.
 */
export function dateBoundsError(value: string, label = "Date"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // datetime-local values are accepted by taking the date portion
  const day = trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
  if (!DATE_RE.test(day) || day < DATE_INPUT_MIN) {
    return `${label} must be on or after 1 January ${DATE_YEAR_MIN}.`;
  }
  if (day > todayDateInputValue()) {
    return `${label} cannot be in the future.`;
  }
  return null;
}
