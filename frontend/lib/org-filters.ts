export const STAGE_OPTIONS = [
  {
    value: "idea",
    label: "Idea",
    description: "Still exploring the concept — no product yet",
  },
  {
    value: "pre_seed",
    label: "Pre-seed",
    description: "Building an early product and testing with first users",
  },
  {
    value: "seed",
    label: "Seed",
    description: "Product is live and you're finding product-market fit",
  },
  {
    value: "series_a",
    label: "Series A",
    description: "Repeatable sales and a team focused on growth",
  },
  {
    value: "growth",
    label: "Growth",
    description: "Scaling revenue, team, and operations",
  },
] as const;

export const SECTOR_OPTIONS = [
  { value: "agrfood", label: "Agri & food" },
  { value: "ai", label: "AI & data" },
  { value: "climate", label: "Climate & energy" },
  { value: "consumer", label: "Consumer" },
  { value: "deeptech", label: "Deeptech & hardware" },
  { value: "edtech", label: "Edtech" },
  { value: "fintech", label: "Fintech" },
  { value: "health", label: "Health & biotech" },
  { value: "marketplace", label: "Marketplace" },
  { value: "media", label: "Media & gaming" },
  { value: "mobility", label: "Mobility & transport" },
  { value: "proptech", label: "Proptech" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel & hospitality" },
  { value: "other", label: "Other" },
] as const;

/** HQ / main team location — not customer markets or legal registration. */
export const GEO_FIELD_LABEL = "Based in";
export const GEO_FIELD_HELP =
  "Where your HQ and main team are located — not where you sell or where the company is legally registered.";
export const GEO_FILTER_LABEL = "Based in";
export const GEO_FILTER_HELP =
  "Companies whose HQ and main team are in this region — not where they have customers.";
/** Same values as org `geo`; label differs because investors express a mandate, not their own HQ. */
export const GEO_INVESTOR_FOCUS_LABEL = "Invest in companies based in";

export const GEO_OPTIONS = [
  {
    value: "portugal",
    label: "Portugal",
    description: "HQ / main team in Portugal",
  },
  {
    value: "europe",
    label: "Europe",
    description: "HQ / main team elsewhere in Europe",
  },
  {
    value: "north_america",
    label: "North America",
    description: "HQ / main team in the US or Canada",
  },
  {
    value: "latin_america",
    label: "Latin America",
    description: "HQ / main team in Latin America",
  },
  {
    value: "remote",
    label: "Remote-first",
    description: "Distributed team with no fixed HQ",
  },
  {
    value: "other",
    label: "Other",
    description: "HQ / main team in another region",
  },
] as const;

export const STAGES = STAGE_OPTIONS.map((option) => option.value);
export const SECTORS = SECTOR_OPTIONS.map((option) => option.value);
export const GEOGRAPHIES = GEO_OPTIONS.map((option) => option.value);

export function stageLabel(value: string): string {
  return STAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function sectorLabel(value: string): string {
  return SECTOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function geoLabel(value: string): string {
  return GEO_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
