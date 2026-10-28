import { ApiError } from "@/lib/api";

/** `{"code": ["…"]}`, `{"detail": "…"}` → per-field messages for a form. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(err.body as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") out[key] = first;
  }
  return out;
}

/** The first readable message in an API error, or the fallback. */
export function firstMessage(err: unknown, fallback: string): string {
  const errors = fieldErrors(err);
  return errors.detail ?? Object.values(errors)[0] ?? fallback;
}
