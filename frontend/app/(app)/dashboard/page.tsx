import { redirect } from "next/navigation";

import type { AdvisorProfile } from "@/components/AdvisoryProfileForm";
import { ProfileAside } from "@/components/dashboard/ProfileAside";
import { ProfileHeaderCard } from "@/components/dashboard/ProfileHeaderCard";
import type { Experience } from "@/components/ExperienceManager";
import { ExperienceManager } from "@/components/ExperienceManager";
import type { PersonalKpiStats } from "@/components/PersonalKpiPanel";
import type { PersonCredential } from "@/components/ProfessionalCredentialsPanel";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import type { Vitality } from "@/lib/person-vitality";
import type { AffiliationSummary } from "@/lib/types";

import {
  PersonalDashboardTabs,
  type PersonalTabId,
} from "./PersonalDashboardTabs";

type Membership = { slug: string; name: string; role: string; logo?: string | null };
type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  city?: string;
  links?: { label: string; url: string }[];
  profile_picture?: string | null;
  handle?: string | null;
  visibility?: Record<string, string>;
  attestation_prefs?: Record<string, boolean>;
  is_complete?: boolean;
  is_verified?: boolean;
};
type MembershipSkill = { id: number; skill: string; status: string };
type PersonMembership = { id: number; org: string; role: string; skills: MembershipSkill[] };
type Me = { email: string; investor_profile: InvestorProfile | null; memberships: PersonMembership[] };
type InvestorPost = {
  id: number;
  kind: string;
  title: string;
  body?: string;
  image?: string | null;
  occurred_at: string;
  ends_at?: string | null;
  created_at: string;
  reaction_count?: number;
  reaction_counts?: { like: number; insight: number; congrats: number };
  feed_impression_count?: number;
};
type BadgeEmbed = {
  html: string;
  profile_url: string;
  badge_url: string;
  json_url: string;
};

const PERSONAL_TABS = ["kpis", "posts", "saved", "settings"] as const;

export const dynamic = "force-dynamic";

function parsePersonalTab(tab?: string): PersonalTabId | undefined {
  if (tab && PERSONAL_TABS.includes(tab as PersonalTabId)) return tab as PersonalTabId;
  return undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = parsePersonalTab(tab);

  let me: Me;
  let orgs: Membership[];
  let profileStats: PersonalKpiStats | null = null;
  let vitality: Vitality | null = null;
  let badgeEmbed: BadgeEmbed | null = null;
  let advisorProfile: AdvisorProfile | null = null;
  let experiences: Experience[] = [];
  let affiliations: AffiliationSummary[] = [];
  let myPosts: InvestorPost[] = [];
  let myCredentials: PersonCredential[] = [];
  try {
    const [meRes, orgsRes, posts, credentialsRes, vitalityRes, experiencesRes, affiliationsRes] =
      await Promise.all([
        apiFetch<Me>("/auth/me/"),
        safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
        safeFetch(apiFetch<InvestorPost[]>("/investors/me/posts/"), []),
        safeFetch(apiFetch<PersonCredential[]>("/credentials/mine/"), [] as PersonCredential[]),
        safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null),
        safeFetch(apiFetch<Experience[]>("/experience/"), [] as Experience[]),
        safeFetch(apiFetch<{ items: AffiliationSummary[] }>("/affiliations/mine/"), { items: [] }),
      ]);
    me = meRes;
    orgs = orgsRes;
    myPosts = posts;
    myCredentials = credentialsRes;
    vitality = vitalityRes;
    experiences = experiencesRes;
    affiliations = affiliationsRes.items;

    if (me.investor_profile?.is_complete) {
      [profileStats, badgeEmbed, advisorProfile] = await Promise.all([
        safeFetch(apiFetch<PersonalKpiStats>("/investors/me/stats/?range=7d"), null),
        safeFetch(apiFetch<BadgeEmbed>("/investors/me/badge-embed/"), null),
        safeFetch(apiFetch<AdvisorProfile>("/advisory/me/"), null),
      ]);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const profileComplete = Boolean(me.investor_profile?.is_complete);
  const memberships = me.memberships.map((m) => ({
    ...m,
    orgName: orgs.find((o) => o.slug === m.org)?.name ?? m.org,
  }));

  const aside = (
    <ProfileAside
      ladder={vitality?.ladder ?? null}
      cadence={vitality?.cadence ?? null}
      completion={vitality?.completion ?? null}
      visibility={me.investor_profile?.visibility}
    />
  );

  return (
    <div className="mx-auto max-w-5xl">
      <ProfileHeaderCard profile={me.investor_profile} email={me.email} />

      {!profileComplete ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <ProfileForm profile={me.investor_profile} variant="onboarding" />
          {aside}
        </div>
      ) : initialTab ? (
        <div className="mt-5">
          <PersonalDashboardTabs
            key={initialTab}
            profile={me.investor_profile}
            profileStats={profileStats}
            vitality={vitality}
            badgeEmbed={badgeEmbed}
            advisorProfile={advisorProfile}
            memberships={memberships}
            myCredentials={myCredentials}
            myPosts={myPosts}
            initialTab={initialTab}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <ExperienceManager experiences={experiences} affiliations={affiliations} />
          {aside}
        </div>
      )}
    </div>
  );
}
