/**
 * The `?ref=` that says where someone came from.
 *
 * Doc `beedero-aquisicao-pessoas.md` §7–§8: every channel gets its own ref
 * (`uni:ist`, `job:123`, `share:waverent`) so that §8.3's funnel can say which
 * of them brought people who stayed. This module is the frontend half — it
 * reads the value out of a URL and hands it to the sign-in form, which posts it
 * to the API alongside the address.
 *
 * Nothing is written to the visitor's device. §8.1 flags the alternative —
 * parking the origin next to the auth state — for legal review on cookie
 * consent; carrying it in the URL and parking it server-side (see
 * accounts/signup_source.py) avoids that question entirely rather than
 * answering it.
 *
 * The sanitising below mirrors `_SOURCE_RE`/`_DETAIL_RE` in that module. Two
 * copies of one rule is a cost, but the alternative is posting whatever a
 * crafted link contains and letting the server be the only thing standing
 * between it and a `GROUP BY`.
 */

const SOURCE_RE = /^[a-z][a-z0-9]{0,19}$/;
const DETAIL_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MAX_REF_LENGTH = 120;

/** Narrow an inbound ref to something safe to post, or "" if it isn't one. */
export function safeRef(value: string | string[] | undefined | null): string {
  // Next hands repeated query params back as an array; a link with two refs is
  // not a link we wrote, so take neither.
  if (typeof value !== "string") return "";
  const ref = value.trim().toLowerCase();
  if (!ref || ref.length > MAX_REF_LENGTH) return "";

  const [source, ...rest] = ref.split(":");
  if (!SOURCE_RE.test(source)) return "";
  const detail = rest.join(":");
  if (!detail) return source;
  return DETAIL_RE.test(detail) ? `${source}:${detail}` : source;
}

/**
 * Build a `ref` for a link out of Beedero — `refFor("job", "123")` → "job:123".
 * Used by the share buttons (§3.4, §4) and the public CTAs, so that every
 * outbound link is attributable without anyone hand-typing the format.
 */
export function refFor(source: string, detail?: string | number | null): string {
  const base = String(source).trim().toLowerCase();
  if (!SOURCE_RE.test(base)) return "";
  if (detail === undefined || detail === null || detail === "") return base;
  const suffix = String(detail).trim().toLowerCase();
  return DETAIL_RE.test(suffix) ? `${base}:${suffix}` : base;
}

/**
 * The registration URL for a visitor arriving from `ref`, landing on `next`.
 *
 * Both params matter and for different reasons: `ref` is measurement, `next` is
 * not losing the person's place. Someone who clicked "apply" on a job page
 * should come back to that job, not to a generic feed — §3.2 is explicit about
 * it, and §11 lists "regresso à vaga depois do registo" as a checklist item.
 */
export function registerUrl(ref: string, next?: string): string {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  const clean = safeRef(ref);
  if (clean) params.set("ref", clean);
  const query = params.toString();
  return `/register${query ? `?${query}` : ""}`;
}
