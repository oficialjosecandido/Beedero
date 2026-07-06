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
};

export type OrgProfile = {
  org: OrgSummary;
  sections: Record<string, Record<string, unknown>>;
};

export const SECTION_LABELS: Record<string, string> = {
  about: "About",
  team: "Team",
  products: "Product",
  market_thesis: "Market thesis",
  links: "Website & Social",
  news: "News",
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
