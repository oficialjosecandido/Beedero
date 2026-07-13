import { notFound, redirect } from "next/navigation";

import { CredibilityBadge } from "@/components/CredibilityBadge";
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
  org: {
    slug: string;
    name: string;
    one_liner: string;
    status: "draft" | "live";
    stage: string;
    sector: string;
    geo: string;
    logo: string | null;
    is_fundraising: boolean;
    is_verified: boolean;
    credibility_level: number;
  };
};
type CredibilityInfo = {
  level: number;
  verifications: Record<
    string,
    {
      status: "pending" | "verified" | "rejected" | "expired";
      valid_until: string | null;
      submitted_at?: string;
      reviewed_at?: string | null;
      rejection_reason?: string;
      payload?: Record<string, unknown>;
    }
  >;
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
type Me = { email: string; is_email_verified: boolean };
type Onboarding = {
  status: "draft" | "live";
  completeness: number;
  refund_eligible: boolean;
  checklist: { key: string; done: boolean; hint: string }[];
  fee: { amount_cents: number; status: string; refund_as_credit: boolean } | null;
};
type OrgActivity = {
  id: number;
  kind: string;
  created_at: string;
  value: {
    title?: string;
    body?: string;
    image?: string | null;
    occurred_at?: string;
  };
};

const POST_REQUIRED_PROFILE_KINDS = ["about", "team"];

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
  let activities: OrgActivity[];
  try {
    [profile, sections, stats, members, me, { items: activities }] = await Promise.all([
      apiFetch(`/orgs/${slug}/`),
      apiFetch(`/orgs/${slug}/sections/`),
      apiFetch(`/orgs/${slug}/stats/`),
      apiFetch(`/orgs/${slug}/members/`),
      apiFetch("/auth/me/"),
      apiFetch(`/orgs/${slug}/feed/`) as Promise<{ items: OrgActivity[] }>,
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const myRole = members.find((m) => m.email === me.email)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const invites: Invite[] = canManage ? await apiFetch(`/orgs/${slug}/invites/`) : [];
  const onboarding: Onboarding | null = canManage
    ? await apiFetch(`/orgs/${slug}/onboarding/`)
    : null;
  const credibility: CredibilityInfo = await apiFetch(`/orgs/${slug}/credibility/`);

  const profileFieldCount = sections
    .filter((section) => POST_REQUIRED_PROFILE_KINDS.includes(section.kind))
    .reduce((count, section) => count + section.fields.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  const hasPostedToday = activities.some(
    (activity) => activity.created_at.slice(0, 10) === today
  );
  const canPostUpdates = profileFieldCount >= 5 && !hasPostedToday;

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-beedero-black/10 bg-gradient-to-br from-beedero-yellow/25 to-beedero-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <OrgLogoForm slug={slug} logo={profile.org.logo} name={profile.org.name} editable={canManage} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {profile.org.name}
                </h1>
                {profile.org.status === "draft" && (
                  <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                    Draft
                  </span>
                )}
                <CredibilityBadge level={profile.org.credibility_level} />
                {profile.org.is_verified && (
                <span className="rounded-full bg-beedero-yellow px-2.5 py-0.5 text-xs font-bold text-beedero-black">
                    Verified
                  </span>
                )}
                {profile.org.is_fundraising && (
                <span className="rounded-full bg-beedero-black px-2.5 py-0.5 text-xs font-bold text-beedero-yellow">
                    Fundraising
                  </span>
                )}
              </div>
              {profile.org.one_liner && (
                <p className="mt-1 text-sm text-zinc-500">{profile.org.one_liner}</p>
              )}
            </div>
          </div>
        </header>

        <OrgTabs
          slug={slug}
          org={profile.org}
          sections={sections}
          activities={activities}
          isFundraising={profile.org.is_fundraising}
          profileFieldCount={profileFieldCount}
          canPostUpdates={canPostUpdates}
          hasPostedToday={hasPostedToday}
          stats={stats}
          members={members}
          invites={invites}
          canManage={canManage}
          onboarding={onboarding}
          isEmailVerified={me.is_email_verified}
          credibility={credibility}
        />
      </div>
    </div>
  );
}
