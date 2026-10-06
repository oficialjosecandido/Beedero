import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  Coins,
  FileCheck2,
  LayoutDashboard,
  Settings2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * The organisation workspace's nav, which is also its tab model: the Figma
 * sidebar order, extended with the sections the platform actually has
 * (jobs, fundraising) so nothing becomes unreachable.
 *
 * `countKey` names the live number the sidebar shows next to a label — the
 * design hard-codes "14" and "2"; here they come from the loaded data.
 */
export const ORG_NAV = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "profile", label: "Public profile", Icon: Building2 },
  { id: "team", label: "Team", Icon: UsersRound, countKey: "team" },
  { id: "activity", label: "Updates", Icon: Sparkles, countKey: "updates" },
  { id: "calendar", label: "Events", Icon: CalendarDays, countKey: "events" },
  { id: "jobs", label: "Jobs", Icon: Briefcase, countKey: "jobs" },
  { id: "fundraising", label: "Fundraising", Icon: Coins },
  { id: "insights", label: "Insights", Icon: BarChart3 },
  { id: "affiliations", label: "Verification", Icon: FileCheck2 },
  { id: "share", label: "Settings", Icon: Settings2 },
] as const satisfies readonly {
  id: string;
  label: string;
  Icon: LucideIcon;
  countKey?: string;
}[];

export type OrgTabId = (typeof ORG_NAV)[number]["id"];
export type OrgNavCountKey = "team" | "updates" | "events" | "jobs";
export type OrgNavCounts = Partial<Record<OrgNavCountKey, number>>;

const ORG_TAB_IDS = new Set<string>(ORG_NAV.map((item) => item.id));

export function parseOrgTab(tab?: string): OrgTabId | undefined {
  return tab && ORG_TAB_IDS.has(tab) ? (tab as OrgTabId) : undefined;
}
