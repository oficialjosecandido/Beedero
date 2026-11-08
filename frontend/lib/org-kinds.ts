/**
 * Startups and companies (backend orgs/kinds.py). A startup has no company
 * yet; a company is incorporated. What differs is the price, the ladder (a
 * startup has no registry rung) and a few tools — everything else is shared.
 */

export type OrgKind = "startup" | "company";

export const KIND_OPTIONS: readonly {
  value: OrgKind;
  label: string;
  short: string;
  description: string;
  points: readonly string[];
}[] = [
  {
    value: "startup",
    label: "Startup",
    short: "Not incorporated yet",
    description: "A team building something, before the company exists.",
    points: ["Find a co-founder", "Raise pre-seed", "Verified by Beedero, no documents"],
  },
  {
    value: "company",
    label: "Company",
    short: "Incorporated",
    description: "A registered company, with a certidão permanente.",
    points: ["Stock options in job posts", "Seed and Series A rounds", "Registry-confirmed on your ladder"],
  },
];

export function kindLabel(kind: string | null | undefined): string {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Organisation";
}

export function kindShort(kind: string | null | undefined): string {
  return KIND_OPTIONS.find((option) => option.value === kind)?.short ?? "";
}

/** Job engagement types a kind can't post (co-founder roles are for startups). */
export function hiddenEngagements(kind: OrgKind): string[] {
  return kind === "startup" ? [] : ["cofounder"];
}

/** Compensation a kind can't offer (stock options need a company). */
export function hiddenCompensation(kind: OrgKind): string[] {
  return kind === "startup" ? ["stock_options"] : [];
}

export const ROUND_STAGES: Record<OrgKind, readonly { value: string; label: string }[]> = {
  startup: [{ value: "pre_seed", label: "Pre-seed" }],
  company: [
    { value: "pre_seed", label: "Pre-seed" },
    { value: "seed", label: "Seed" },
    { value: "series_a", label: "Series A" },
  ],
};
