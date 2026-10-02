import { FeedComposer } from "./FeedComposer";
import { FeedList } from "./FeedList";
import { FeedRightColumn } from "./FeedRightColumn";
import type { FeedItem } from "./types";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import type { TrendingItem } from "@/components/TrendingPanel";
import type { RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { redirect } from "next/navigation";

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

function greetingFor(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${first}.`;
  if (hour < 18) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  let me: Me;
  let hasPostedToday = false;
  let myPosts: InvestorPost[] = [];
  let vitality: Vitality | null = null;
  let recommendations: {
    organizations: { slug: string; name: string; one_liner?: string; logo?: string | null }[];
  } = { organizations: [] };

  try {
    const [feed, meRes, posts, recRes] = await Promise.all([
      apiFetch<{ items: FeedItem[]; next_cursor: string | null }>("/feed/"),
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
      safeFetch(
        apiFetch<{
          organizations: { slug: string; name: string; one_liner?: string; logo?: string | null }[];
        }>("/recommendations/"),
        { organizations: [] }
      ),
      // Keep these warm in parallel — used lightly / reserved for later panels.
      safeFetch(apiFetch<{ items: TrendingItem[] }>("/trending/"), { items: [] }),
      safeFetch(apiFetch<{ items: RecentOrgUpdateItem[] }>("/recent-org-updates/"), { items: [] }),
      safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
    ]);
    ({ items, next_cursor } = feed);
    me = meRes;
    myPosts = posts;
    recommendations = recRes;
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
    .map((post) => ({
      id: post.id,
      title: post.title,
      occurred_at: post.occurred_at,
      ends_at: post.ends_at,
    }));

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,630px)_minmax(270px,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <section className="min-w-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              The network, today
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              {greetingFor(displayName)}
            </h1>
          </div>
        </div>

        <div className="mt-7">
          <FeedComposer
            name={displayName}
            profilePicture={profile?.profile_picture}
            profileComplete={profileComplete}
            hasPostedToday={hasPostedToday}
            completeness={vitality?.completeness ?? 0}
            checklist={vitality?.checklist ?? []}
          />
        </div>

        <div className="mt-5">
          <FeedList initialItems={items} initialCursor={next_cursor} />
        </div>
      </section>

      <FeedRightColumn organizations={recommendations.organizations} events={events} />
    </div>
  );
}
