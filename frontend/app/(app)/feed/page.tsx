import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import { ChatPanel } from "./ChatPanel";
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
type PersonSummary = { id: number; name: string; headline?: string; profile_picture?: string | null };
type MessageContacts = { items: PersonSummary[] };

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  let me: Me;
  let orgs: Membership[];
  let messageContacts: PersonSummary[];
  let hasPostedToday = false;
  try {
    const [feed, meRes, orgsRes, contactsRes, myPosts] = await Promise.all([
      apiFetch("/feed/"),
      apiFetch("/auth/me/"),
      safeFetch(apiFetch("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch("/contacts/") as Promise<MessageContacts>, { items: [] }),
      safeFetch(apiFetch("/investors/me/posts/") as Promise<InvestorPost[]>, []),
    ]);
    ({ items, next_cursor } = feed);
    me = meRes;
    orgs = orgsRes;
    messageContacts = contactsRes.items;
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
    <main className="flex flex-1 justify-center px-4 py-8 lg:px-6">
      <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="order-2 lg:order-none lg:col-start-1">
          <AppSidebar me={me} orgs={orgs} currentPage="feed" />
        </aside>

        <div className="order-1 flex flex-col gap-8 lg:order-none lg:col-start-2">
          <header>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
              Feed
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Updates from people and organizations you follow
            </h1>
          </header>

          <FeedComposer
            name={displayName}
            profilePicture={profile?.profile_picture}
            profileComplete={profileComplete}
            hasPostedToday={hasPostedToday}
          />

          <FeedList initialItems={items} initialCursor={next_cursor} />
        </div>

        <aside className="order-3 lg:order-none lg:col-start-3">
          <Suspense fallback={null}>
            <ChatPanel people={messageContacts} />
          </Suspense>
        </aside>
      </div>
    </main>
  );
}
