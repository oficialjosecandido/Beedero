import { notFound, redirect } from "next/navigation";

import { OrgWorkspaceHeader } from "@/components/org-workspace/OrgWorkspaceHeader";
import { parseOrgTab } from "@/components/org-workspace/tabs";
import type { LadderRung, SignalItem } from "@/components/org-workspace/OrgOverview";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import { OrgWorkspace } from "./OrgWorkspace";
import type { PostingStatus } from "@/components/OrgPostComposer";
import { formatDateTime } from "@/lib/format";
import { GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import type { AffiliationSummary, JobSummary } from "@/lib/types";

type SectionField = {
  id: number;
  key: string;
  value: unknown;
  visibility: string;
  created_at?: string;
};
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgSummary = {
  org: {
    slug: string;
    name: string;
    one_liner: string;
    status: "draft" | "live";
    stage: string;
    sector: string;
    geo: string;
    logo: string | null;
    is_fundraising: boolean;
    is_verified: boolean;
    credibility_level: number;
  };
};
type Stats = { followers_count: number; visitors_count: number };
type Member = {
  id: number;
  email: string;
  full_name: string;
  profile_picture?: string | null;
  role: string;
  title?: string;
};
type Invite = {
  id: number;
  token: string;
  role: string;
  created_at: string;
  revoked_at: string | null;
  uses_count: number;
  is_active: boolean;
};
type Me = {
  email: string;
  memberships?: { org: string; role: string }[];
};
type Onboarding = {
  status: "draft" | "live";
  completeness: number;
  refund_eligible: boolean;
  publish_ready: boolean;
  checklist: { key: string; done: boolean; hint: string; weight: number }[];
  fee: { amount_cents: number; status: string; refund_as_credit: boolean } | null;
};
type OrgActivity = {
  id: number;
  kind: string;
  created_at: string;
  value: {
    title?: string;
    body?: string;
    image?: string | null;
    occurred_at?: string;
    ends_at?: string | null;
  };
};
type Vitality = {
  items: { key: string; label: string; done: boolean; hint: string }[];
  done_count: number;
  total_count: number;
  presence: {
    investor_views: number;
    new_followers: number;
    interest: number;
    since_days: number;
    has_signal: boolean;
  };
  badge: {
    level: number;
    visual_status: "verified" | "expiring" | "expired" | "unverified";
    valid_until: string | null;
    days_until_expiry: number | null;
  };
};
type BadgeEmbed = {
  html: string;
  verify_url: string;
  badge_url: string;
  json_url: string;
};
type AttendingEvent = {
  id: number;
  title: string;
  body?: string;
  occurred_at: string;
  ends_at?: string | null;
  host: { type: "org" | "person"; name: string; slug?: string; id?: number };
};
type FundraiseRound = {
  id: number;
  valuation: number | null;
  ask_amount: number | null;
  raised_amount: number | null;
  use_of_funds: string;
  stage: string;
  is_open: boolean;
  opened_at: string;
  closed_at: string | null;
};

const POSTING_STATUS_FALLBACK = (): PostingStatus => ({
  can_post: true,
  next_slot_at: null,
  allowed_kinds: ["update", "milestone", "event"],
  locked_kinds: [],
  credibility_level: 0,
  freshness: null,
});

const ONBOARDING_FALLBACK = (status: "draft" | "live"): Onboarding => ({
  status,
  completeness: 0,
  refund_eligible: false,
  publish_ready: false,
  checklist: [],
  fee: null,
});

/** `seed` → "Seed"; unknown codes show as they are rather than disappearing. */
function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string
): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? value;
}

/** The first non-empty string field of a section — the curated forms store
 *  plain strings, but a free-form field could hold anything. */
function sectionText(section: Section | undefined, key: string): string {
  const value = section?.fields.find((field) => field.key === key)?.value;
  return typeof value === "string" ? value.trim() : "";
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Team member",
};

/** The sidebar says "Your role: …" — the title the team gave you reads better
 *  there than the access level, so prefer it when one is set. */
function myRoleLabel(title: string | undefined, role: string) {
  return title?.trim() || ROLE_LABELS[role] || role;
}

/** The soonest event still ahead of us, for the narrative's "Next event" tile.
 *  The clock reading lives here, outside the component body, because reading it
 *  during render is impure. */
function upcomingEvent<T extends { occurred_at: string }>(events: readonly T[]): T | undefined {
  const now = Date.now();
  return [...events]
    .filter((event) => new Date(event.occurred_at).getTime() >= now)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())[0];
}

export default async function DashboardOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ suggested_title?: string; suggested_body?: string; tab?: string }>;
}) {
  const { slug } = await params;
  const { suggested_title: suggestedTitle, suggested_body: suggestedBody, tab } = await searchParams;
  const initialTab = parseOrgTab(tab);

  let profile: OrgSummary;
  let sections: Section[];
  let stats: Stats;
  let members: Member[];
  let me: Me;
  let activities: OrgActivity[];
  let roundHistory: FundraiseRound[];
  let onboarding: Onboarding | null;
  let attendingEvents: AttendingEvent[];
  let postingStatus: PostingStatus;
  try {
    [profile, sections, stats, members, me, { items: activities }, roundHistory, onboarding, attendingEvents, postingStatus] =
      await Promise.all([
        apiFetch(`/orgs/${slug}/`) as Promise<OrgSummary>,
        apiFetch(`/orgs/${slug}/sections/`) as Promise<Section[]>,
        apiFetch(`/orgs/${slug}/stats/`) as Promise<Stats>,
        apiFetch(`/orgs/${slug}/members/`) as Promise<Member[]>,
        apiFetch("/auth/me/") as Promise<Me>,
        apiFetch(`/orgs/${slug}/feed/`) as Promise<{ items: OrgActivity[] }>,
        apiFetch(`/orgs/${slug}/rounds/`) as Promise<FundraiseRound[]>,
        safeFetch(apiFetch(`/orgs/${slug}/onboarding/`) as Promise<Onboarding>, null),
        safeFetch(
          apiFetch<AttendingEvent[]>(`/me/events/attending/?exclude_org=${encodeURIComponent(slug)}`),
          []
        ),
        safeFetch(
          apiFetch<PostingStatus>(`/orgs/${slug}/posting-status/`),
          POSTING_STATUS_FALLBACK()
        ),
      ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const onboardingData = onboarding ?? ONBOARDING_FALLBACK(profile.org.status);

  const membershipRole = me.memberships?.find((membership) => membership.org === slug)?.role;
  const listedRole = members.find(
    (member) => member.email.toLowerCase() === me.email.toLowerCase()
  )?.role;
  const myRole = membershipRole ?? listedRole ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const [invites, badgeEmbed, vitality, jobs, affiliations] = await Promise.all([
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/invites/`) as Promise<Invite[]>, [])
      : Promise.resolve([] as Invite[]),
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/badge-embed/`) as Promise<BadgeEmbed>, null)
      : Promise.resolve(null),
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/vitality/`) as Promise<Vitality>, null)
      : Promise.resolve(null),
    canManage
      ? safeFetch(
          apiFetch(`/orgs/${slug}/jobs/`) as Promise<{ items: JobSummary[] }>,
          { items: [] as JobSummary[] }
        )
      : Promise.resolve({ items: [] as JobSummary[] }),
    canManage
      ? safeFetch(
          apiFetch(`/orgs/${slug}/affiliations/`) as Promise<{ items: AffiliationSummary[] }>,
          { items: [] as AffiliationSummary[] }
        )
      : Promise.resolve({ items: [] as AffiliationSummary[] }),
  ]);

  const postingStatusData = postingStatus;

  const createdEvents = activities
    .filter((activity) => activity.kind === "events")
    .map((activity) => ({
      id: activity.id,
      title: activity.value.title ?? "Event",
      occurred_at: activity.value.occurred_at ?? activity.created_at,
      ends_at: activity.value.ends_at,
      body: activity.value.body,
      role: "created" as const,
    }));
  const participatingEvents = attendingEvents.map((event) => ({
    id: event.id,
    title: event.title,
    occurred_at: event.occurred_at,
    ends_at: event.ends_at,
    body: event.body,
    role: "attending" as const,
    host: event.host,
  }));
  const events = [...createdEvents, ...participatingEvents];

  const aboutSection = sections.find((section) => section.kind === "about");
  const productsSection = sections.find((section) => section.kind === "products");

  // The ladder is the real evidence list when the viewer can see it; everyone
  // else gets the profile checklist, which is the same idea at a lower tier.
  const ladder: LadderRung[] = vitality
    ? vitality.items.map((item) => ({
        key: item.key,
        label: item.label,
        hint: item.hint,
        done: item.done,
      }))
    : onboardingData.checklist.map((item) => ({
        key: item.key,
        label: item.key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        hint: item.hint,
        done: item.done,
      }));

  const signals: SignalItem[] = activities.slice(0, 5).map((activity) => ({
    id: activity.id,
    kind: activity.kind,
    title: activity.value.title ?? "Update",
    detail: activity.value.body ?? "",
    at: activity.value.occurred_at ?? activity.created_at,
  }));

  const nextEvent = upcomingEvent(events);

  const capitalRaised = roundHistory.reduce(
    (total, round) => total + (round.raised_amount ?? 0),
    0
  );

  const myMembership = members.find(
    (member) => member.email.toLowerCase() === me.email.toLowerCase()
  );
  const myName = myMembership?.full_name ?? me.email;

  return (
    <main className="min-h-screen bg-org-ground text-org-ink">
      <OrgWorkspaceHeader personName={myName} />

      <OrgWorkspace
        initialTab={suggestedTitle ? "activity" : (initialTab ?? "overview")}
        identity={{
          name: profile.org.name,
          logo: profile.org.logo,
          slug,
          isVerified: profile.org.is_verified,
          myRole: myRoleLabel(myMembership?.title, myRole),
          completeness: onboardingData.completeness,
          verifiedSignals: vitality?.done_count ?? 0,
        }}
        hero={{
          name: profile.org.name,
          logo: profile.org.logo,
          oneLiner: profile.org.one_liner,
          slug,
          isVerified: profile.org.is_verified,
          isDraft: profile.org.status === "draft",
          isFundraising: profile.org.is_fundraising,
          meta: [
            optionLabel(GEO_OPTIONS, profile.org.geo),
            [optionLabel(SECTOR_OPTIONS, profile.org.sector), optionLabel(STAGE_OPTIONS, profile.org.stage)]
              .filter(Boolean)
              .join(" · "),
          ].filter(Boolean),
          teamCount: members.length,
          capitalRaised: capitalRaised > 0 ? capitalRaised : null,
          recordScore: onboardingData.completeness,
          verifiedSignals: vitality?.done_count ?? 0,
        }}
        narrative={{
          mission: sectionText(aboutSection, "mission"),
          summary: sectionText(aboutSection, "summary"),
          focus: sectionText(productsSection, "overview"),
          nextEvent: nextEvent
            ? { title: nextEvent.title, at: formatDateTime(nextEvent.occurred_at) }
            : null,
        }}
        ladder={ladder}
        signals={signals}
        counts={{
          team: members.length,
          updates: activities.length,
          events: events.length,
          jobs: jobs.items.length,
        }}
        tabs={{
          slug,
          org: profile.org,
          sections,
          activities,
          events,
          isFundraising: profile.org.is_fundraising,
          roundHistory,
          postingStatus: postingStatusData,
          stats,
          members,
          invites,
          canManage,
          onboarding: onboardingData,
          badgeEmbed,
          vitality,
          jobs: jobs.items,
          affiliations: affiliations.items,
          suggestedTitle,
          suggestedBody,
        }}
      />
    </main>
  );
}
