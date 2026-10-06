/**
 * `GET /investors/me/vitality/` — the private view a person has of their own
 * standing. Three separate ideas, kept separate on purpose (see the backend's
 * accounts/vitality.py):
 *
 *   `ladder`     — only what somebody else confirmed. Never goes down.
 *   `cadence`    — the weekly posting duty, measured as a streak.
 *   `completion` — the self-declared fields.
 *
 * `completeness`/`checklist` are the older strength meter: they still feed
 * discovery ranking and the onboarding wizard, so they stay.
 */

export type LadderRung = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** Who vouches for this rung — "You" on the two that nobody else confirms. */
  attested_by: string;
  /** What was confirmed, once it is: "Co-founder at Alma Labs", "/p/ada". */
  detail: string;
  /** Non-empty only when something needs attention, e.g. an expiring licence. */
  warning: string;
};

export type VerificationLadder = {
  rungs: LadderRung[];
  done_count: number;
  total_count: number;
  /** How far up without skipping — lower than `done_count` when a rung below a
   *  completed one is still open. */
  level: number;
};

export type PostingCadence = {
  posted_this_week: boolean;
  streak_weeks: number;
  best_streak_weeks: number;
  weeks_posted: number;
  week_started_on: string;
  days_left: number;
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
