import { redirect } from "next/navigation";

import type { FeedItem } from "@/app/(app)/feed/types";
import type { RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { resolveOrgNewsUpdates } from "@/components/RecentOrgUpdatesPanel";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

type Membership = { slug: string; name: string; role: string; logo?: string | null };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  profile_picture?: string | null;
  handle?: string | null;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type InvestorPost = {
  id: number;
  kind: string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
};
type ProfileStats = {
  profile_views_count: number;
  post_impressions_count: number;
  range_days: number;
};
type NetworkCounts = { connections: number; pending: number; following: number; followers: number };

export type AppShellData = {
  me: Me;
  orgs: Membership[];
  events: { id: number | string; title: string; occurred_at: string; ends_at?: string | null }[];
  stats: ProfileStats | null;
  orgNews: RecentOrgUpdateItem[];
  network: NetworkCounts | null;
};

export async function loadAppShellData(): Promise<AppShellData> {
  try {
    const [me, orgs, posts, updatesRes, statsRes, feedRes, networkRes] = await Promise.all([
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
      safeFetch(apiFetch<{ items: RecentOrgUpdateItem[] }>("/recent-org-updates/"), { items: [] }),
      safeFetch(apiFetch<ProfileStats>("/investors/me/stats/"), null),
      safeFetch(apiFetch<{ items: FeedItem[]; next_cursor: string | null }>("/feed/?limit=20"), {
        items: [],
        next_cursor: null,
      }),
      safeFetch(apiFetch<NetworkCounts>("/network/counts/"), null),
    ]);

    const events = posts
      .filter((post) => post.kind === "events")
      .map((post) => ({
        id: post.id,
        title: post.title,
        occurred_at: post.occurred_at,
        ends_at: post.ends_at,
      }));

    return {
      me,
      orgs,
      events,
      stats: statsRes,
      orgNews: resolveOrgNewsUpdates(updatesRes.items, feedRes.items),
      network: networkRes,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
}
