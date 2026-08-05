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
