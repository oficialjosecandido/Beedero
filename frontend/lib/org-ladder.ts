/**
 * The organisation's verification ladder — `ladder` in
 * `GET /orgs/<slug>/onboarding/` (backend orgs/ladder.py). Same shape as the
 * person's (lib/person-vitality.ts): eight rungs, and the first four (the
 * "team" band) are the gate. All four = 50% = the organisation can be
 * published, and only then is it listed in Discover.
 */

export type OrgLadderBand = "team" | "others" | "record";

/** Where a rung's button goes: a workspace tab, the person's own profile, or nowhere. */
export type OrgLadderAction = "profile" | "personal_profile" | "team" | "registry" | "activity" | null;

export type OrgLadderRung = {
  key: string;
  band: OrgLadderBand;
  label: string;
  hint: string;
  done: boolean;
  /** Submitted and waiting for review (the registry check). */
  pending: boolean;
  /** Who vouches for it — "The team" on the first band. */
  attested_by: string;
  /** What was confirmed: "Ana Silva", "1 person confirmed", "valid until …". */
  detail: string;
  /** Something needs attention: a check about to run out, ran out or was turned down. */
  warning: string;
  action: OrgLadderAction;
  /** Days in a row with an update, for the last rung; null elsewhere. */
  progress: number | null;
};

export type OrgLadder = {
  rungs: OrgLadderRung[];
  done_count: number;
  total_count: number;
  /** done / total, floored — exactly 50 at the gate. */
  percent: number;
  /** Rungs 1–4 done. */
  unlocked: boolean;
  unlock_missing: string[];
  next: string | null;
  level: number;
  status: "draft" | "live";
  /** Live and past the gate: in Discover right now. */
  listed: boolean;
  /** Draft and past the gate: the Publish button works. */
  can_publish: boolean;
};

/** Confirmations from outside the team — rungs 5–7 done. */
export function confirmationsCount(ladder: OrgLadder | null): number {
  return ladder ? ladder.rungs.filter((rung) => rung.band === "others" && rung.done).length : 0;
}
