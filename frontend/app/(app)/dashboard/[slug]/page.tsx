import { notFound, redirect } from "next/navigation";

import { CredibilityBadge } from "@/components/CredibilityBadge";
import { OrgDashboardSidebar } from "@/components/OrgDashboardSidebar";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import { OrgLogoForm } from "./OrgLogoForm";
import { OrgTabs } from "./OrgTabs";

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
type CredibilityInfo = {
  level: number;
  verifications: Record<
    string,
    {
      status: "pending" | "verified" | "rejected" | "expired";
      valid_until: string | null;
      submitted_at?: string;
      reviewed_at?: string | null;
      rejection_reason?: string;
      payload?: Record<string, unknown>;
    }
  >;
};
type Stats = { followers_count: number; visitors_count: number };
type Member = {
  id: number;
  email: string;
  full_name: string;
  profile_picture?: string | null;
  role: string;
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
  checklist: { key: string; done: boolean; hint: string }[];
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

const ONBOARDING_FALLBACK = (status: "draft" | "live"): Onboarding => ({
  status,
  completeness: 0,
  refund_eligible: false,
  publish_ready: false,
  checklist: [],
  fee: null,
});

const CREDIBILITY_FALLBACK: CredibilityInfo = { level: 0, verifications: {} };
const ORG_TABS = ["overview", "calendar", "activity", "profile", "fundraising", "credibility"] as const;
type OrgTabId = (typeof ORG_TABS)[number];

function parseOrgTab(tab?: string): OrgTabId | undefined {
  if (tab && ORG_TABS.includes(tab as OrgTabId)) return tab as OrgTabId;
  return undefined;
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
  try {
    [profile, sections, stats, members, me, { items: activities }, roundHistory, onboarding] =
      await Promise.all([
        apiFetch(`/orgs/${slug}/`) as Promise<OrgSummary>,
        apiFetch(`/orgs/${slug}/sections/`) as Promise<Section[]>,
        apiFetch(`/orgs/${slug}/stats/`) as Promise<Stats>,
        apiFetch(`/orgs/${slug}/members/`) as Promise<Member[]>,
        apiFetch("/auth/me/") as Promise<Me>,
        apiFetch(`/orgs/${slug}/feed/`) as Promise<{ items: OrgActivity[] }>,
        apiFetch(`/orgs/${slug}/rounds/`) as Promise<FundraiseRound[]>,
        safeFetch(apiFetch(`/orgs/${slug}/onboarding/`) as Promise<Onboarding>, null),
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
  const [invites, credibility, badgeEmbed, vitality] = await Promise.all([
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/invites/`) as Promise<Invite[]>, [])
      : Promise.resolve([] as Invite[]),
    safeFetch(apiFetch(`/orgs/${slug}/credibility/`) as Promise<CredibilityInfo>, CREDIBILITY_FALLBACK),
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/badge-embed/`) as Promise<BadgeEmbed>, null)
      : Promise.resolve(null),
    canManage
      ? safeFetch(apiFetch(`/orgs/${slug}/vitality/`) as Promise<Vitality>, null)
      : Promise.resolve(null),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const hasPostedToday = activities.some(
    (activity) => activity.created_at.slice(0, 10) === today
  );
  const canPostUpdates = !hasPostedToday;
  const events = activities
    .filter((activity) => activity.kind === "events")
    .map((activity) => ({
      id: activity.id,
      title: activity.value.title ?? "Event",
      occurred_at: activity.value.occurred_at ?? activity.created_at,
      ends_at: activity.value.ends_at,
      body: activity.value.body,
    }));

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-beedero-border bg-gradient-to-br from-beedero-yellow/25 to-beedero-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <OrgLogoForm slug={slug} logo={profile.org.logo} name={profile.org.name} editable={canManage} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
                  {profile.org.name}
                </h1>
                {profile.org.status === "draft" && (
                  <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                    Draft
                  </span>
                )}
                <CredibilityBadge level={profile.org.credibility_level} />
                {profile.org.is_verified && (
                <span className="rounded-full bg-beedero-yellow px-2.5 py-0.5 text-xs font-bold text-beedero-black">
                    Verified
                  </span>
                )}
                {profile.org.is_fundraising && (
                <span className="rounded-full bg-beedero-black px-2.5 py-0.5 text-xs font-bold text-beedero-yellow">
                    Fundraising
                  </span>
                )}
              </div>
              {profile.org.one_liner && (
                <p className="mt-1 text-sm text-zinc-500">{profile.org.one_liner}</p>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
          <div className="order-2 lg:order-none">
            <OrgDashboardSidebar events={events} />
          </div>

          <div className="order-1 lg:order-none">
            <OrgTabs
              slug={slug}
              org={profile.org}
              sections={sections}
              activities={activities}
              events={events}
              isFundraising={profile.org.is_fundraising}
              roundHistory={roundHistory}
              canPostUpdates={canPostUpdates}
              hasPostedToday={hasPostedToday}
              stats={stats}
              members={members}
              invites={invites}
              canManage={canManage}
              onboarding={onboardingData}
              credibility={credibility}
              badgeEmbed={badgeEmbed}
              vitality={vitality}
              suggestedTitle={suggestedTitle}
              suggestedBody={suggestedBody}
              initialTab={initialTab}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
