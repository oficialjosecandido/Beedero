import { notFound } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { OrgLogoForm } from "./OrgLogoForm";
import { OrgTabs } from "./OrgTabs";

type SectionField = {
  id: number;
  key: string;
  value: unknown;
  visibility: string;
  created_at?: string;
};
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgSummary = {
  org: { slug: string; name: string; logo: string | null; is_fundraising: boolean; is_verified: boolean };
};
type Stats = { followers_count: number; visitors_count: number };
type Member = { id: number; email: string; role: string };
type Invite = {
  id: number;
  token: string;
  role: string;
  created_at: string;
  revoked_at: string | null;
  uses_count: number;
  is_active: boolean;
};
type Me = { email: string };

const IDENTITY_FIELD_COUNT_KINDS = ["about", "team", "products", "market_thesis"];
const ACTIVITY_KINDS = ["news", "milestones", "events", "awards", "press"];

export default async function DashboardOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let profile: OrgSummary;
  let sections: Section[];
  let stats: Stats;
  let members: Member[];
  let me: Me;
  try {
    [profile, sections, stats, members, me] = await Promise.all([
      apiFetch(`/orgs/${slug}/`),
      apiFetch(`/orgs/${slug}/sections/`),
      apiFetch(`/orgs/${slug}/stats/`),
      apiFetch(`/orgs/${slug}/members/`),
      apiFetch("/auth/me/"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }

  const myRole = members.find((m) => m.email === me.email)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const invites: Invite[] = canManage ? await apiFetch(`/orgs/${slug}/invites/`) : [];

  const profileFieldCount = sections
    .filter((section) => IDENTITY_FIELD_COUNT_KINDS.includes(section.kind))
    .reduce((count, section) => count + section.fields.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  const hasPostedToday = sections
    .filter((section) => ACTIVITY_KINDS.includes(section.kind))
    .some((section) =>
      section.fields.some(
        (field) => field.key.startsWith("post_") && field.created_at?.slice(0, 10) === today
      )
    );
  const canPostUpdates = profileFieldCount >= 5 && !hasPostedToday;

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <OrgLogoForm slug={slug} logo={profile.org.logo} name={profile.org.name} editable={canManage} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {profile.org.name}
                </h1>
                {profile.org.is_verified && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Verified
                  </span>
                )}
                {profile.org.is_fundraising && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Fundraising
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <OrgTabs
          slug={slug}
          sections={sections}
          isFundraising={profile.org.is_fundraising}
          profileFieldCount={profileFieldCount}
          canPostUpdates={canPostUpdates}
          hasPostedToday={hasPostedToday}
          stats={stats}
          members={members}
          invites={invites}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
