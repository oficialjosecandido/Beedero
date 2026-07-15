import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { CreateOrgForm } from "@/components/CreateOrgForm";
import { InvestorPostForm } from "@/components/InvestorPostForm";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiError, apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

import { ChatPanel } from "../feed/ChatPanel";
import { followOrgAction, followUserAction } from "./actions";

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
type MessageContacts = { items: PersonSummary[] };
type OrgStats = {
  followers_count: number;
  visitors_count: number;
  range_days: number;
  new_followers: number;
  profile_views: number;
};

export default async function DashboardPage() {
  let me: Me, orgs: Membership[], recommendations: Recommendations;
  let messageContacts: PersonSummary[] = [];
  let orgStats: { org: Membership; stats: OrgStats }[] = [];
  try {
    const [meRes, orgsRes, recommendationsRes, contactsRes] = await Promise.all([
      apiFetch("/auth/me/"),
      apiFetch("/orgs/"),
      apiFetch("/recommendations/"),
      apiFetch("/contacts/") as Promise<MessageContacts>,
    ]);
    me = meRes;
    orgs = orgsRes;
    recommendations = recommendationsRes;
    messageContacts = contactsRes.items;

    if (orgs.length > 0) {
      const stats = await Promise.all(
        orgs.map((org) => apiFetch(`/orgs/${org.slug}/stats/`) as Promise<OrgStats>)
      );
      orgStats = orgs.map((org, index) => ({ org, stats: stats[index] }));
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  const profileComplete = Boolean(me.investor_profile?.is_complete);

  return (
    <main className="flex flex-1 justify-center px-4 py-8 lg:px-6">
      <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <AppSidebar me={me} orgs={orgs} currentPage="dashboard" />
        </aside>

        <div className="flex flex-col gap-10">
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
          ) : (
            <>
              <section>
                <h2 className="text-xl font-semibold">Your KPIs</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Followers and profile visitors across the organizations you manage.
                </p>
                {orgStats.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-beedero-black/20 bg-beedero-white p-5 text-sm text-zinc-600">
                    You don&apos;t manage any organization yet. Create one below to start
                    tracking KPIs.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {orgStats.map(({ org, stats }) => (
                      <div
                        key={org.slug}
                        className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          {org.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logo} alt="" className="size-7 rounded-lg object-cover" />
                          ) : (
                            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500">
                              {org.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <p className="truncate font-medium">{org.name}</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-2xl font-semibold">{stats.followers_count}</p>
                            <p className="text-xs text-zinc-500">Followers</p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">{stats.visitors_count}</p>
                            <p className="text-xs text-zinc-500">Visitors</p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">{stats.new_followers}</p>
                            <p className="text-xs text-zinc-500">
                              New followers ({stats.range_days}d)
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">{stats.profile_views}</p>
                            <p className="text-xs text-zinc-500">
                              Profile views ({stats.range_days}d)
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <h2 className="text-xl font-semibold">Recommended to follow</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Follow organizations to shape your feed. If you follow nothing, Beedero is
                    followed automatically.
                  </p>
                </div>
                <div className="grid gap-3">
                  {recommendations.organizations.length === 0 && (
                    <p className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-4 text-sm text-zinc-500">
                      No recommendations yet.
                    </p>
                  )}
                  {recommendations.organizations.map((org) => (
                    <div
                      key={org.slug}
                      className="flex items-center justify-between rounded-2xl border border-beedero-black/10 bg-beedero-white px-4 py-3 shadow-sm"
                    >
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-zinc-400">@{org.slug}</p>
                        </div>
                        {org.one_liner && <p className="text-xs text-zinc-600">{org.one_liner}</p>}
                        <p className="text-xs text-zinc-500">
                          {org.stage} · {org.sector} · {org.geo}
                        </p>
                      </div>
                      <form action={followOrgAction}>
                        <input type="hidden" name="slug" value={org.slug} />
                        <button className="rounded-xl border border-beedero-black/15 px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-beedero-yellow">
                          Follow
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <h2 className="text-xl font-semibold">People to follow</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Follow other investors to see their milestones, events, and updates in your
                    feed.
                  </p>
                </div>
                <div className="grid gap-3">
                  {recommendations.people.length === 0 && (
                    <p className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-4 text-sm text-zinc-500">
                      No recommendations yet.
                    </p>
                  )}
                  {recommendations.people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between rounded-2xl border border-beedero-black/10 bg-beedero-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {person.profile_picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.profile_picture}
                            alt=""
                            className="size-9 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <p className="font-medium">{person.name}</p>
                          {person.headline && (
                            <p className="text-xs text-zinc-500">{person.headline}</p>
                          )}
                        </div>
                      </div>
                      <form action={followUserAction}>
                        <input type="hidden" name="user_id" value={person.id} />
                        <button className="rounded-xl border border-beedero-black/15 px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-beedero-yellow">
                          Follow
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <h2 className="text-xl font-semibold">Share an update</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Post a milestone, event, or update to your followers&apos; feed. Events and
                    updates can include one photo; milestones are text-only.
                  </p>
                </div>
                <InvestorPostForm />
              </section>

              <section
                id="create-organization"
                className="grid scroll-mt-24 gap-5 border-t border-zinc-200 pt-8 lg:grid-cols-[0.8fr_1.2fr]"
              >
                <div>
                  <h2 className="text-xl font-semibold">Create new organization</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    The public URL is generated automatically from the organization name.
                  </p>
                </div>
                <CreateOrgForm />
              </section>
            </>
          )}
        </div>

        <aside className="hidden lg:block">
          <Suspense fallback={null}>
            <ChatPanel people={messageContacts} />
          </Suspense>
        </aside>
      </div>
    </main>
  );
}
