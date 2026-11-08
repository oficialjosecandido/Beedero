import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  Coins,
  CreditCard,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  Settings2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { OrgKind } from "@/lib/org-kinds";

/**
 * The organisation workspace's nav, which is also its tab model: the Figma
 * sidebar order, extended with the sections the platform actually has
 * (jobs, fundraising) so nothing becomes unreachable.
 *
 * `countKey` names the live number the sidebar shows next to a label — the
 * design hard-codes "14" and "2"; here they come from the loaded data.
 *
 * `only` keeps an item to one kind of organisation (lib/org-kinds.ts): the
 * Co-founders section is for startups. Tabs shared by both can still differ
 * inside — Fundraising, Jobs and Verification read the kind themselves.
 */
export const ORG_NAV = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "profile", label: "Public profile", Icon: Building2 },
  { id: "team", label: "Team", Icon: UsersRound, countKey: "team" },
  { id: "cofounders", label: "Co-founders", Icon: Handshake, countKey: "cofounders", only: "startup" },
  { id: "activity", label: "Updates", Icon: Sparkles, countKey: "updates" },
  { id: "calendar", label: "Events", Icon: CalendarDays, countKey: "events" },
  { id: "jobs", label: "Jobs", Icon: Briefcase, countKey: "jobs" },
  { id: "fundraising", label: "Fundraising", Icon: Coins },
  { id: "insights", label: "Insights", Icon: BarChart3 },
  { id: "affiliations", label: "Verification", Icon: FileCheck2 },
  { id: "billing", label: "Plan", Icon: CreditCard },
  { id: "share", label: "Settings", Icon: Settings2 },
] as const satisfies readonly {
  id: string;
  label: string;
  Icon: LucideIcon;
  countKey?: string;
  only?: OrgKind;
}[];

export type OrgTabId = (typeof ORG_NAV)[number]["id"];
export type OrgNavCountKey = "team" | "cofounders" | "updates" | "events" | "jobs";
export type OrgNavCounts = Partial<Record<OrgNavCountKey, number>>;

const ORG_TAB_IDS = new Set<string>(ORG_NAV.map((item) => item.id));

export function parseOrgTab(tab?: string): OrgTabId | undefined {
  return tab && ORG_TAB_IDS.has(tab) ? (tab as OrgTabId) : undefined;
}

/** The sidebar of one kind of organisation. */
export function orgNavFor(kind: OrgKind) {
  return ORG_NAV.filter((item) => !("only" in item) || item.only === kind);
}

/** A tab this kind of organisation has, or the Overview. */
export function tabFor(kind: OrgKind, tab: OrgTabId): OrgTabId {
  return orgNavFor(kind).some((item) => item.id === tab) ? tab : "overview";
}
