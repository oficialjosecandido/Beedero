export type OrgSummary = {
  slug: string;
  name: string;
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
  about: "Sobre",
  team: "Equipa",
  products: "Produto",
  market_thesis: "Tese de mercado",
  news: "Novidades",
  milestones: "Milestones",
  events: "Eventos",
  awards: "Prémios",
  press: "Imprensa",
  valuation: "Valuation",
  ask: "Ask",
  use_of_funds: "Use of funds",
  financials: "Financials",
  dataroom: "Data room",
  cap_table: "Cap table",
};
