import { redirect } from "next/navigation";

import { AppColumnHeader } from "@/components/AppColumnHeader";
import { AppRightColumn } from "@/components/AppRightColumn";
import { ProfileColumn } from "@/components/ProfileColumn";
import { SuggestedFollowsPanel } from "@/components/SuggestedFollowsPanel";
import { TrendingPanel, type TrendingItem } from "@/components/TrendingPanel";
import type { RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { resolveOrgNewsUpdates } from "@/components/RecentOrgUpdatesPanel";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import { FeedComposer } from "./FeedComposer";
import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

type InvestorPost = {
  id: number;
  kind: string;
  title: string;
  created_at: string;
  occurred_at: string;
  ends_at?: string | null;
};

type ChecklistItem = { key: string; done: boolean; hint: string; weight: number };
type Vitality = { completeness: number; checklist: ChecklistItem[] };
type Membership = { slug: string; name: string; role: string; logo?: string | null };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  is_complete?: boolean;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type ProfileStats = { profile_views_count: number; post_impressions_count: number; range_days: number };
type NetworkCounts = { connections: number; pending: number; following: number; followers: number };

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  let me: Me;
  let orgs: Membership[];
  let hasPostedToday = false;
  let myPosts: InvestorPost[] = [];
  let trending: TrendingItem[] = [];
  let recentOrgUpdates: RecentOrgUpdateItem[] = [];
  let stats: ProfileStats | null = null;
  let network: NetworkCounts | null = null;
  let vitality: Vitality | null = null;
  let recommendations: { organizations: { slug: string; name: string; one_liner?: string; logo?: string | null }[] } = {
    organizations: [],
  };
  try {
    const [feed, meRes, orgsRes, posts, trendingRes, updatesRes, statsRes, recRes, networkRes] = await Promise.all([
      apiFetch<{ items: FeedItem[]; next_cursor: string | null }>("/feed/"),
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
      safeFetch(apiFetch<{ items: TrendingItem[] }>("/trending/"), { items: [] }),
      safeFetch(apiFetch<{ items: RecentOrgUpdateItem[] }>("/recent-org-updates/"), { items: [] }),
      safeFetch(apiFetch<ProfileStats>("/investors/me/stats/"), null),
      safeFetch(apiFetch<{ organizations: { slug: string; name: string; one_liner?: string; logo?: string | null }[] }>("/recommendations/"), {
        organizations: [],
      }),
      safeFetch(apiFetch<NetworkCounts>("/network/counts/"), null),
    ]);
    ({ items, next_cursor } = feed);
    me = meRes;
    orgs = orgsRes;
    myPosts = posts;
    trending = trendingRes.items;
    recentOrgUpdates = updatesRes.items;
    stats = statsRes;
    recommendations = recRes;
    network = networkRes;
    const today = new Date().toISOString().slice(0, 10);
    hasPostedToday = myPosts.some((post) => post.created_at.slice(0, 10) === today);
    if (!me.investor_profile?.is_complete) {
      vitality = await safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const profile = me.investor_profile;
  const profileComplete = Boolean(profile?.is_complete);
  const displayName = profile?.full_name || me.email;
  const events = myPosts
    .filter((post) => post.kind === "events")
    .map((post) => ({ id: post.id, title: post.title, occurred_at: post.occurred_at, ends_at: post.ends_at }));

  const orgNews = resolveOrgNewsUpdates(recentOrgUpdates, items);

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-1 lg:order-none">
          <ProfileColumn me={me} orgs={orgs} events={events} stats={stats} network={network} />
        </div>

        <div className="order-2 flex flex-col gap-4 lg:order-none lg:gap-6">
          <div className="hidden lg:block">
            <AppColumnHeader label="Feed" />
          </div>

          <FeedComposer
            name={displayName}
            profilePicture={profile?.profile_picture}
            profileComplete={profileComplete}
            hasPostedToday={hasPostedToday}
            completeness={vitality?.completeness ?? 0}
            checklist={vitality?.checklist ?? []}
          />

          {items.length < 3 && recommendations.organizations.length > 0 && (
            <SuggestedFollowsPanel organizations={recommendations.organizations} />
          )}

          <FeedList initialItems={items} initialCursor={next_cursor} />

          {trending.length > 0 && <TrendingPanel items={trending} />}
        </div>

        <div className="order-3 lg:order-none">
          <AppRightColumn updates={orgNews} />
        </div>
      </div>
    </main>
  );
}
