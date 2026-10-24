/**
 * `GET /investors/me/vitality/` — the private view a person has of their own
 * standing. Three separate ideas, kept separate on purpose (see the backend's
 * accounts/vitality.py):
 *
 *   `ladder`     — eight rungs, from "email confirmed" to "a week of daily
 *                  posts". The first four (the "you" band) are the gate: all
 *                  four = 50% = listed in Discover and allowed to send
 *                  connection requests (accounts/ladder.py).
 *   `cadence`    — the daily posting duty (shown as the current week), as a streak.
 *   `completion` — the self-declared fields.
 *
 * `completeness`/`checklist` are the older strength meter: they still feed
 * discovery ranking and the onboarding wizard, so they stay.
 */

/** Who the step depends on: the person alone, someone else, or their record. */
export type LadderBand = "you" | "others" | "record";

/** Where a rung's button sends the person — a section id on /profile, or a page. */
export type LadderAction =
  | "identity"
  | "about"
  | "experience"
  | "skills"
  | "discover"
  | "post"
  | null;

export type LadderRung = {
  key: string;
  band: LadderBand;
  label: string;
  hint: string;
  done: boolean;
  /** Who vouches for this rung — "You" on the four of the first band. */
  attested_by: string;
  /** What was confirmed, once it is: "Co-founder at Alma Labs", "/p/ada". */
  detail: string;
  /** Non-empty only when something needs attention, e.g. an expiring licence. */
  warning: string;
  action: LadderAction;
  /** Days posted in a row, for the last rung; null elsewhere. */
  progress: number | null;
};

export type VerificationLadder = {
  rungs: LadderRung[];
  done_count: number;
  total_count: number;
  /** done / total, floored — exactly 50 when the four "you" rungs are done. */
  percent: number;
  /** Rungs 1–4 done: listed in Discover, may send connection requests. */
  unlocked: boolean;
  /** Keys of the gate rungs still open, in order. */
  unlock_missing: string[];
  /** The first open rung, or null when all eight are done. */
  next: string | null;
  level: number;
};

export type PostingCadence = {
  posted_today: boolean;
  streak_days: number;
  best_streak_days: number;
  days_posted: number;
  week_started_on: string;
  /** Mon–Sun of the current Lisbon week — true when that day has a personal post. */
  week_days: boolean[];
  /** Mon=0 … Sun=6 on the Lisbon calendar. */
  today_index: number;
  hours_left: number;
  last_post_at: string | null;
};

export type ProfileCompletion = {
  items: { key: string; label: string; hint: string; done: boolean }[];
  done_count: number;
  total_count: number;
  percent: number;
};

export type Vitality = {
  completeness: number;
  checklist: { key: string; done: boolean; hint: string }[];
  done_count: number;
  total_count: number;
  ladder: VerificationLadder;
  cadence: PostingCadence;
  completion: ProfileCompletion;
  presence: { profile_views: number; since_days: number; has_signal: boolean };
  badge: {
    handle: string | null;
    name: string;
    verified: boolean;
    visual_status: "verified" | "unverified";
    as_of: string;
  };
};
