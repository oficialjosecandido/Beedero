import Link from "next/link";

import { CreateOrgForm } from "@/components/CreateOrgForm";
import { InvestorPostForm } from "@/components/InvestorPostForm";
import { ProfileForm } from "@/components/ProfileForm";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";
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
type Me = { email: string; is_email_verified: boolean; investor_profile: InvestorProfile | null };
type PersonSummary = { id: number; name: string; headline?: string; profile_picture?: string | null };
type Recommendations = { organizations: OrgSummary[]; people: PersonSummary[] };

export default async function DashboardPage() {
  const [me, orgs, recommendations]: [Me, Membership[], Recommendations] = await Promise.all([
    apiFetch("/auth/me/"),
    apiFetch("/orgs/"),
    apiFetch("/recommendations/"),
  ]);
  const profileComplete = Boolean(me.investor_profile?.is_complete);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-5xl flex-col gap-10">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-beedero-black">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
        </header>

        {!me.is_email_verified && <VerifyEmailBanner />}

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
            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-xl font-semibold">Manage your organizations</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Create a company profile or open an existing organization dashboard.
                </p>
                <a
                  href="#create-organization"
                  className="mt-4 inline-flex rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
                >
                  Create organization
                </a>
              </div>
              <div className="flex flex-col gap-2">
                {orgs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-beedero-black/20 bg-beedero-white p-5 text-sm text-zinc-600">
                    You don&apos;t manage any organization yet. Create your first draft below.
                  </div>
                ) : (
                  orgs.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/dashboard/${m.slug}`}
                      className="flex items-center justify-between rounded-2xl border border-beedero-black/10 bg-beedero-white px-4 py-3 shadow-sm hover:border-beedero-yellow"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {m.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.logo} alt="" className="size-8 rounded-lg object-cover" />
                        ) : (
                          <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500">
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {m.name}
                      </span>
                      <span className="rounded-full bg-beedero-black px-3 py-1 text-xs font-bold text-beedero-yellow">
                        Manage
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-xl font-semibold">Recommended to follow</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Follow organizations to shape your feed. If you follow nothing, Beedero is
                  followed automatically.
                </p>
                <Link
                  href="/feed"
                  className="mt-4 inline-flex rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
                >
                  Open feed
                </Link>
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
                  Follow other investors to see their milestones, events, and updates in your feed.
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
                        {person.headline && <p className="text-xs text-zinc-500">{person.headline}</p>}
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
    </main>
  );
}
