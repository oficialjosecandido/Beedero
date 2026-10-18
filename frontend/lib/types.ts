export type OrgSummary = {
  slug: string;
  name: string;
  one_liner?: string;
  status?: "draft" | "live";
  logo?: string | null;
  stage?: string;
  sector?: string;
  geo?: string;
  is_verified: boolean;
  is_fundraising: boolean;
  credibility_level?: number;
  freshness?: string | null;
};

export type OrgTeamMember = {
  full_name: string;
  title?: string;
  profile_picture?: string | null;
  handle?: string | null;
};

export type UpcomingEvent = {
  id: number;
  kind: string;
  value: {
    title?: string;
    body?: string;
    occurred_at?: string;
    ends_at?: string | null;
    payload?: {
      format?: string;
      location?: string;
      registration_url?: string;
    };
  };
};

export type OrgProfile = {
  org: OrgSummary;
  sections: Record<string, Record<string, unknown>>;
  team_members?: OrgTeamMember[];
  upcoming_events?: UpcomingEvent[];
  viewer_is_following?: boolean;
  viewer_is_member?: boolean;
};

export type JobCompensation = { kind: string; detail: string };

export type JobSummary = {
  id: number;
  org: OrgSummary;
  title: string;
  description: string;
  role_area: string;
  engagement_type: string;
  location_type: string;
  location_city: string;
  salary_text: string;
  skills: string[];
  compensation: JobCompensation[];
  status: "draft" | "open" | "closed";
  created_at: string;
  expires_at: string | null;
  renewal_count: number;
};

/**
 * A job as a stranger sees it (`/api/public/jobs/`, doc §3.1).
 *
 * Separate from `JobSummary` because the payloads are deliberately different:
 * the public one carries no `status` or `renewal_count` — a visitor only ever
 * sees open, unexpired jobs — and its org block is the handful of fields that
 * are already public on /o/<slug>, not the authenticated org summary.
 */
export type PublicJobOrg = {
  slug: string;
  name: string;
  one_liner: string;
  logo: string | null;
  is_verified: boolean;
  credibility_level: number;
};

export type PublicJob = {
  id: number;
  org: PublicJobOrg;
  title: string;
  description: string;
  role_area: string;
  engagement_type: string;
  engagement_label: string;
  location_type: string;
  location_label: string;
  location_city: string;
  salary_text: string;
  skills: string[];
  compensation: JobCompensation[];
  created_at: string;
  expires_at: string | null;
};

/** Keyset, not offset: `next_cursor` is opaque and there is no total. */
export type PublicJobsPage = {
  items: PublicJob[];
  next_cursor: string | null;
};

/**
 * The person's three-step onboarding (`/api/onboarding/`, doc §6.3).
 *
 * `intents` is the one place these are ever read: they are private
 * capabilities that decide what somebody is shown first (§6.4), and §9 forbids
 * them appearing as labels on a public profile. Nothing outside the onboarding
 * screens should import this type to display them.
 */
export type OnboardingState = {
  completed: boolean;
  completed_at: string | null;
  full_name: string;
  handle: string;
  /** After onboarding the handle is an address someone may have shared. */
  handle_locked: boolean;
  handle_suggestion: string;
  city: string;
  headline: string;
  intents: string[];
  primary_intent: string;
};

export type IntentOption = { value: string; label: string };

export type SuggestedOrg = {
  slug: string;
  name: string;
  one_liner: string;
  logo: string | null;
  is_verified: boolean;
  sector: string;
  /** Someone on this team declared the viewer's city; false for the fallback. */
  is_local: boolean;
};

export type SuggestedPerson = {
  /** `recipient_id` for POST /connections/requests/ — the card's one action. */
  user_id: number;
  handle: string;
  name: string;
  headline: string;
  city: string;
  avatar: string | null;
  is_verified: boolean;
  skills: string[];
};

/** §6.3's closing screen — five follows so the feed isn't empty. */
export type OnboardingSuggestions = {
  city: string;
  /** Whether this city has a scene yet, so the screen can say so plainly. */
  is_local: boolean;
  orgs: SuggestedOrg[];
  people: SuggestedPerson[];
};

export type ApplicantSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
};

export type ApplicationSummary = {
  id: number;
  job_id: number;
  applicant: ApplicantSummary;
  note: string;
  external_link: string;
  status: "applied" | "viewed" | "interested" | "declined" | "hired";
  created_at: string;
};

export type AffiliationPerson = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
};

export type AffiliationSummary = {
  id: number;
  org: OrgSummary;
  person: AffiliationPerson;
  role: "founder" | "employee" | "contractor" | "volunteer" | "advisor";
  title: string;
  started_on: string;
  ended_on: string | null;
  skills: string[];
  status: "self_declared" | "pending" | "verified" | "disputed";
  verified_via: "org" | "registry" | null;
  verified_at: string | null;
  is_org_added: boolean;
  created_at: string;
};

/** An emailed invite to someone with no Beedero account yet (aquisição §2). */
export type TeamInviteSummary = {
  id: number;
  email: string;
  name: string;
  role: AffiliationSummary["role"];
  role_label: string;
  title: string;
  started_on: string | null;
  answer: "open" | "accepted" | "declined" | "expired";
  created_at: string;
  reminded_at: string | null;
  expires_at: string;
};

export type TeamInviteQuota = {
  per_day: number;
  per_week: number;
  remaining_today: number;
  remaining_this_week: number;
};

export const SECTION_LABELS: Record<string, string> = {
  about: "About",
  team: "Team",
  products: "Products",
  market_thesis: "Market thesis",
  links: "Website & Social",
  update: "Update",
  news: "Update",
  milestones: "Milestones",
  events: "Events",
  awards: "Awards",
  press: "Press",
  valuation: "Valuation",
  ask: "Ask",
  use_of_funds: "Use of funds",
  financials: "Financials",
  dataroom: "Data room",
  cap_table: "Cap table",
};
