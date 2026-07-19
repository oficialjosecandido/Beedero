import { redirect } from "next/navigation";

import { AppColumnHeader } from "@/components/AppColumnHeader";
import {
  PersonBadgeEmbedPanel,
  PersonPresenceSignalsPanel,
  ProfileStrengthPanel,
} from "@/components/PersonalProfilePanels";
import { ProfileColumn } from "@/components/ProfileColumn";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

type Membership = { slug: string; name: string; role: string; logo?: string | null };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  handle?: string | null;
  visibility?: Record<string, string>;
  attestation_prefs?: Record<string, boolean>;
  is_complete?: boolean;
  is_verified?: boolean;
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
  followers_count: number;
  following_count: number;
  range_days: number;
  new_followers: number;
  posts_count: number;
  reactions_received: number;
};
type Vitality = {
  completeness: number;
  checklist: { key: string; done: boolean; hint: string }[];
  done_count: number;
  total_count: number;
  presence: { profile_views: number; since_days: number; has_signal: boolean };
  badge: {
    handle: string | null;
    name: string;
    verified: boolean;
    visual_status: "verified" | "unverified";
    as_of: string;
  };
};
type BadgeEmbed = {
  html: string;
  profile_url: string;
  badge_url: string;
  json_url: string;
};

function PersonalKpiCard({ stats }: { stats: ProfileStats }) {
  const metrics = [
    {
      label: "Followers",
      value: stats.followers_count,
      hint:
        stats.new_followers > 0
          ? `+${stats.new_followers} in the last ${stats.range_days} days`
          : `No new followers in the last ${stats.range_days} days`,
    },
    {
      label: "Following",
      value: stats.following_count,
    },
    {
      label: "Posts published",
      value: stats.posts_count,
    },
    {
      label: "Reactions received",
      value: stats.reactions_received,
    },
  ] as const;

  return (
    <section className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="border-b border-beedero-border pb-5">
        <h2 className="text-xl font-extrabold text-zinc-900">Your KPIs</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Followers, posts, and engagement on your personal profile.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-beedero-border/70 bg-gradient-to-br from-beedero-yellow/15 to-beedero-white p-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
              {metric.label}
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-zinc-900">
              {metric.value}
            </p>
            {"hint" in metric && metric.hint && (
              <p
                className={`mt-1 text-xs font-medium ${
                  stats.new_followers > 0 ? "text-emerald-600" : "text-zinc-400"
                }`}
              >
                {metric.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  let me: Me;
  let orgs: Membership[];
  let profileStats: ProfileStats | null = null;
  let vitality: Vitality | null = null;
  let badgeEmbed: BadgeEmbed | null = null;
  let myPosts: InvestorPost[] = [];
  try {
    const [meRes, orgsRes, posts] = await Promise.all([
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
      safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
    ]);
    me = meRes;
    orgs = orgsRes;
    myPosts = posts;

    if (me.investor_profile?.is_complete) {
      [profileStats, vitality, badgeEmbed] = await Promise.all([
        safeFetch(apiFetch<ProfileStats>("/investors/me/stats/"), null),
        safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null),
        safeFetch(apiFetch<BadgeEmbed>("/investors/me/badge-embed/"), null),
      ]);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  const profileComplete = Boolean(me.investor_profile?.is_complete);
  const events = myPosts
    .filter((post) => post.kind === "events")
    .map((post) => ({ id: post.id, title: post.title, occurred_at: post.occurred_at, ends_at: post.ends_at }));

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <div className="order-1 lg:order-none">
          <ProfileColumn me={me} orgs={orgs} events={events} />
        </div>

        <div className="order-2 flex flex-col gap-4 lg:order-none lg:gap-6">
          <AppColumnHeader label="Dashboard" />

          {!profileComplete ? (
            <section className="flex flex-col gap-5">
              <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                <h2 className="text-xl font-extrabold">Complete your personal profile</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Before creating organizations, add enough context so Beedero can recommend
                  people and organizations to follow.
                </p>
              </div>
              <ProfileForm profile={me.investor_profile} />
            </section>
          ) : (
            <section className="flex flex-col gap-5">
              {vitality && (
                <>
                  <ProfileStrengthPanel
                    checklist={vitality.checklist}
                    doneCount={vitality.done_count}
                    totalCount={vitality.total_count}
                    completeness={vitality.completeness}
                  />
                  <PersonPresenceSignalsPanel presence={vitality.presence} />
                </>
              )}
              {badgeEmbed && vitality && (
                <PersonBadgeEmbedPanel embed={badgeEmbed} badge={vitality.badge} />
              )}
              {profileStats && <PersonalKpiCard stats={profileStats} />}
              <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
                <h2 className="text-xl font-extrabold">Profile settings</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Update your details, public handle, visibility, and attestation preferences.
                </p>
              </div>
              <ProfileForm profile={me.investor_profile} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
