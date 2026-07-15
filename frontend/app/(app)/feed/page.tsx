import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

import { ChatPanel } from "./ChatPanel";
import { FeedList } from "./FeedList";
import { FeedSidebar } from "./FeedSidebar";
import type { FeedItem } from "./types";

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
type PersonSummary = { id: number; name: string; headline?: string; profile_picture?: string | null };
type Recommendations = { organizations: OrgSummary[]; people: PersonSummary[] };

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  let me: Me;
  let orgs: Membership[];
  let recommendations: Recommendations;
  try {
    const [feed, meRes, orgsRes, recommendationsRes] = await Promise.all([
      apiFetch("/feed/"),
      apiFetch("/auth/me/"),
      apiFetch("/orgs/"),
      apiFetch("/recommendations/"),
    ]);
    ({ items, next_cursor } = feed);
    me = meRes;
    orgs = orgsRes;
    recommendations = recommendationsRes;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-8 lg:px-6">
      <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <FeedSidebar me={me} orgs={orgs} />
        </aside>

        <div className="flex flex-col gap-8">
          <header>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
              Feed
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Updates from people and organizations you follow
            </h1>
          </header>

          <FeedList initialItems={items} initialCursor={next_cursor} />
        </div>

        <aside className="hidden lg:block">
          <Suspense fallback={null}>
            <ChatPanel people={recommendations.people} />
          </Suspense>
        </aside>
      </div>
    </main>
  );
}
