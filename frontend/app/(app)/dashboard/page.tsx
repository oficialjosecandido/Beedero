import Link from "next/link";

import { CreateOrgForm } from "@/components/CreateOrgForm";
import { ProfileForm } from "@/components/ProfileForm";
import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";
import { followOrgAction } from "./actions";

type Membership = { slug: string; name: string; role: string };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  is_complete?: boolean;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type Recommendations = { organizations: OrgSummary[]; people: unknown[] };

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
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
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
            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-xl font-semibold">Recommended to follow</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Follow organizations to shape your feed. If you follow nothing, Beedero is
                  followed automatically.
                </p>
                <Link
                  href="/feed"
                  className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Open feed
                </Link>
              </div>
              <div className="grid gap-3">
                {recommendations.organizations.length === 0 && (
                  <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                    No recommendations yet.
                  </p>
                )}
                {recommendations.organizations.map((org) => (
                  <div
                    key={org.slug}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-zinc-500">
                        {org.stage} · {org.sector} · {org.geo}
                      </p>
                    </div>
                    <form action={followOrgAction}>
                      <input type="hidden" name="slug" value={org.slug} />
                      <button className="rounded-xl border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                        Follow
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-xl font-semibold">Your organizations</h2>
                {orgs.length === 0 && (
                  <p className="mt-2 text-sm text-zinc-500">
                    You&apos;re not a member of any organization yet.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {orgs.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/dashboard/${m.slug}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-200"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-zinc-500">{m.role}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid gap-5 border-t border-zinc-200 pt-8 lg:grid-cols-[0.8fr_1.2fr]">
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
