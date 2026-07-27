import { redirect } from "next/navigation";

import { AppColumnHeader } from "@/components/AppColumnHeader";
import { AppRightColumn } from "@/components/AppRightColumn";
import { ProfileColumn } from "@/components/ProfileColumn";
import type { RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { resolveOrgNewsUpdates } from "@/components/RecentOrgUpdatesPanel";
import type { FeedItem } from "@/app/(app)/feed/types";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import {
  PersonalDashboardTabs,
  type PersonalTabId,
} from "./PersonalDashboardTabs";

type Membership = { slug: string; name: string; role: string; logo?: string | null };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  cover_image?: string | null;
  handle?: string | null;
  visibility?: Record<string, string>;
  attestation_prefs?: Record<string, boolean>;
  is_complete?: boolean;
  is_verified?: boolean;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type InvestorPost = {
  id: number;
  kind: string;
  title: string;
  body?: string;
  image?: string | null;
  occurred_at: string;
  ends_at?: string | null;
  created_at: string;
  reaction_count?: number;
  reaction_counts?: { like: number; insight: number; congrats: number };
  feed_impression_count?: number;
};
type ProfileStats = {
  profile_views_count: number;
  post_impressions_count: number;
  range_days: number;
  new_followers: number;
  posts_count: number;
  reactions_received: number;
};
type Vitality = {
  completeness: number;
  checklist: { key: string; done: boolean; hint: string }[];
  done_count: number;
  total_count: number;
  presence: { profile_views: number; since_days: number; has_signal: boolean };
  badge: {
    handle: string | null;
    name: string;
    verified: boolean;
    visual_status: "verified" | "unverified";
    as_of: string;
  };
};
type BadgeEmbed = {
  html: string;
  profile_url: string;
  badge_url: string;
  json_url: string;
};

const PERSONAL_TABS = ["kpis", "posts", "saved", "settings"] as const;

export const dynamic = "force-dynamic";

function parsePersonalTab(tab?: string): PersonalTabId | undefined {
  if (tab && PERSONAL_TABS.includes(tab as PersonalTabId)) return tab as PersonalTabId;
  return undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = parsePersonalTab(tab);

  let me: Me;
  let orgs: Membership[];
  let profileStats: ProfileStats | null = null;
  let vitality: Vitality | null = null;
  let badgeEmbed: BadgeEmbed | null = null;
  let myPosts: InvestorPost[] = [];
  let recentOrgUpdates: RecentOrgUpdateItem[] = [];
  let feedItems: FeedItem[] = [];
  try {
    const [meRes, orgsRes, posts, updatesRes, feedRes] = await Promise.all([
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
      safeFetch(apiFetch<{ items: RecentOrgUpdateItem[] }>("/recent-org-updates/"), { items: [] }),
      safeFetch(apiFetch<{ items: FeedItem[]; next_cursor: string | null }>("/feed/?limit=20"), {
        items: [],
        next_cursor: null,
      }),
    ]);
    me = meRes;
    orgs = orgsRes;
    myPosts = posts;
    recentOrgUpdates = updatesRes.items;
    feedItems = feedRes.items;

    if (me.investor_profile?.is_complete) {
      [profileStats, vitality, badgeEmbed] = await Promise.all([
        safeFetch(apiFetch<PersonalKpiStats>("/investors/me/stats/?range=7d"), null),
        safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null),
        safeFetch(apiFetch<BadgeEmbed>("/investors/me/badge-embed/"), null),
      ]);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  const profileComplete = Boolean(me.investor_profile?.is_complete);
  const events = myPosts
    .filter((post) => post.kind === "events")
    .map((post) => ({ id: post.id, title: post.title, occurred_at: post.occurred_at, ends_at: post.ends_at }));

  const orgNews = resolveOrgNewsUpdates(recentOrgUpdates, feedItems);

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-1 lg:order-none">
          <ProfileColumn me={me} orgs={orgs} events={events} stats={profileStats} />
        </div>

        <div className="order-2 flex flex-col gap-4 lg:order-none lg:gap-6">
          <AppColumnHeader label="Dashboard" />

          {!profileComplete ? (
            <ProfileForm profile={me.investor_profile} variant="onboarding" />
          ) : (
            <PersonalDashboardTabs
              key={initialTab ?? "kpis"}
              profile={me.investor_profile}
              profileStats={profileStats}
              vitality={vitality}
              badgeEmbed={badgeEmbed}
              myPosts={myPosts}
              initialTab={initialTab}
            />
          )}
        </div>

        <div className="order-3 lg:order-none">
          <AppRightColumn updates={orgNews} />
        </div>
      </div>
    </main>
  );
}
