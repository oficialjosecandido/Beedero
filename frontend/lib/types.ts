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
  viewer_actions?: {
    can_message: boolean;
    connection_status: "none" | "pending_sent" | "connected";
  };
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
