export const STAGE_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "growth", label: "Growth" },
] as const;

export const SECTOR_OPTIONS = [
  { value: "software", label: "Software" },
  { value: "fintech", label: "Fintech" },
  { value: "health", label: "Health" },
  { value: "climate", label: "Climate" },
  { value: "consumer", label: "Consumer" },
  { value: "marketplace", label: "Marketplace" },
  { value: "other", label: "Other" },
] as const;

export const GEO_OPTIONS = [
  { value: "portugal", label: "Portugal" },
  { value: "europe", label: "Europe" },
  { value: "north_america", label: "North America" },
  { value: "latin_america", label: "Latin America" },
  { value: "remote", label: "Remote" },
  { value: "other", label: "Other" },
] as const;

export const STAGES = STAGE_OPTIONS.map((option) => option.value);
export const SECTORS = SECTOR_OPTIONS.map((option) => option.value);
export const GEOGRAPHIES = GEO_OPTIONS.map((option) => option.value);
