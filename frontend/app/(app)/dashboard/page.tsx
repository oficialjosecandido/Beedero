import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import { ChatPanel } from "../feed/ChatPanel";

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
type ProfileStats = {
  followers_count: number;
  following_count: number;
  range_days: number;
  new_followers: number;
  posts_count: number;
  reactions_received: number;
};

export default async function DashboardPage() {
  let me: Me;
  let orgs: Membership[];
  let messageContacts: PersonSummary[] = [];
  let profileStats: ProfileStats | null = null;
  try {
    const [meRes, orgsRes, contactsRes] = await Promise.all([
      apiFetch("/auth/me/"),
      safeFetch(apiFetch("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch("/contacts/") as Promise<MessageContacts>, { items: [] }),
    ]);
    me = meRes;
    orgs = orgsRes;
    messageContacts = contactsRes.items;

    if (me.investor_profile?.is_complete) {
      profileStats = await safeFetch(apiFetch("/investors/me/stats/") as Promise<ProfileStats>, null);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  const profileComplete = Boolean(me.investor_profile?.is_complete);

  return (
    <main className="flex flex-1 justify-center px-4 py-8 lg:px-6">
      <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="order-2 lg:order-none lg:col-start-1">
          <AppSidebar me={me} orgs={orgs} currentPage="dashboard" />
        </aside>

        <div className="order-1 flex flex-col gap-10 lg:order-none lg:col-start-2">
          <header>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-beedero-black">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
          </header>

          {!profileComplete ? (
            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-xl font-semibold">Complete your personal profile</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Before creating organizations, add enough context so Beedero can recommend
                  people and organizations to follow.
                </p>
              </div>
              <ProfileForm profile={me.investor_profile} />
            </section>
          ) : profileStats ? (
            <section>
              <h2 className="text-xl font-semibold">Your KPIs</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Followers, posts, and engagement on your personal profile.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                  <p className="text-2xl font-semibold">{profileStats.followers_count}</p>
                  <p className="text-xs text-zinc-500">Followers</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    +{profileStats.new_followers} in the last {profileStats.range_days} days
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                  <p className="text-2xl font-semibold">{profileStats.following_count}</p>
                  <p className="text-xs text-zinc-500">Following</p>
                </div>
                <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                  <p className="text-2xl font-semibold">{profileStats.posts_count}</p>
                  <p className="text-xs text-zinc-500">Posts published</p>
                </div>
                <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                  <p className="text-2xl font-semibold">{profileStats.reactions_received}</p>
                  <p className="text-xs text-zinc-500">Reactions received</p>
                </div>
              </div>
            </section>
          ) : null}
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
