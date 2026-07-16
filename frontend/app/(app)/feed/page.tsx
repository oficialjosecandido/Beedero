import { redirect } from "next/navigation";

import { AppColumnHeader } from "@/components/AppColumnHeader";
import { ProfileColumn } from "@/components/ProfileColumn";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import { FeedComposer } from "./FeedComposer";
import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

type InvestorPost = { created_at: string };

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

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  let me: Me;
  let orgs: Membership[];
  let hasPostedToday = false;
  try {
    const [feed, meRes, orgsRes, myPosts] = await Promise.all([
      apiFetch("/feed/"),
      apiFetch("/auth/me/"),
      safeFetch(apiFetch("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch("/investors/me/posts/") as Promise<InvestorPost[]>, []),
    ]);
    ({ items, next_cursor } = feed);
    me = meRes;
    orgs = orgsRes;
    const today = new Date().toISOString().slice(0, 10);
    hasPostedToday = myPosts.some((post) => post.created_at.slice(0, 10) === today);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const profile = me.investor_profile;
  const profileComplete = Boolean(profile?.is_complete);
  const displayName = profile?.full_name || me.email;

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <div className="order-1 lg:order-none">
          <ProfileColumn me={me} orgs={orgs} />
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
          />

          <FeedList initialItems={items} initialCursor={next_cursor} />
        </div>
      </div>
    </main>
  );
}
