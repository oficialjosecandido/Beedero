import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";

import { btnGhost } from "@/components/app-shell/ui";
import { NextStepStrip, ProfileAside } from "@/components/dashboard/ProfileAside";
import { ShareProfileModal } from "@/components/dashboard/ShareProfileModal";
import type { Experience, OrgMembershipExperience } from "@/components/ExperienceManager";
import { ExperienceManager } from "@/components/ExperienceManager";
import { LinkedInImport } from "@/components/LinkedInImport";
import { AccountSection } from "@/components/profile/AccountSection";
import { EmailPreferencesSection } from "@/components/profile/EmailPreferencesSection";
import { ProfileEditorProvider } from "@/components/profile/ProfileEditorContext";
import {
  AboutSection,
  IdentitySection,
  InvestmentFocusSection,
  SkillsSection,
  type EditableProfile,
} from "@/components/profile/sections";
import { VisibilityPill } from "@/components/profile/VisibilityPill";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import type { Vitality } from "@/lib/person-vitality";
import { aggregateSkillTime } from "@/lib/skill-duration";
import type { AffiliationSummary, OnboardingState } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS = ["identity", "about", "experience", "skills", "investing"];

type MembershipSkill = { id: number; skill: string; status: string };
type PersonMembership = {
  id: number;
  org: string;
  org_name?: string;
  org_logo?: string | null;
  org_status?: string;
  role: string;
  role_label?: string;
  title?: string;
  description?: string;
  started_on?: string;
  ended_on?: string | null;
  details_status?: "confirmed" | "pending";
  skills: MembershipSkill[];
};

type Me = {
  email: string;
  investor_profile: EditableProfile | null;
  memberships: PersonMembership[];
};

/**
 * My profile — one page, one URL. Every section reads like the public
 * profile and edits in place with its own Save; who-sees-what sits on the
 * section it governs. KPIs and posts moved to /profile/insights.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; tab?: string }>;
}) {
  const { edit, tab } = await searchParams;
  // Old deep links (emails, bookmarks, other pages) keep working.
  if (tab === "kpis" || tab === "posts") redirect(`/profile/insights?tab=${tab}`);
  if (tab === "saved") redirect("/feed");
  if (tab === "settings") redirect("/profile");

  let me: Me;
  let orgs: { slug: string; name: string }[] = [];
  let vitality: Vitality | null = null;
  let experiences: Experience[] = [];
  let affiliations: AffiliationSummary[] = [];
  let onboarding: OnboardingState | null = null;
  let badgeEmbed: { html: string; profile_url: string; badge_url: string; json_url: string } | null = null;
  try {
    let affiliationsRes: { items: AffiliationSummary[] };
    [me, orgs, vitality, experiences, affiliationsRes, onboarding, badgeEmbed] = await Promise.all([
      apiFetch<Me>("/auth/me/"),
      safeFetch(apiFetch<{ slug: string; name: string }[]>("/orgs/"), []),
      safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null),
      safeFetch(apiFetch<Experience[]>("/experience/"), [] as Experience[]),
      safeFetch(apiFetch<{ items: AffiliationSummary[] }>("/affiliations/mine/"), { items: [] }),
      safeFetch(apiFetch<OnboardingState>("/onboarding/"), null),
      safeFetch(
        apiFetch<{ html: string; profile_url: string; badge_url: string; json_url: string }>(
          "/investors/me/badge-embed/"
        ),
        null
      ),
    ]);
    affiliations = affiliationsRes.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const profile = me.investor_profile ?? {};
  const intents = onboarding?.intents ?? [];
  const orgNameOf = (m: PersonMembership) =>
    m.org_name ?? orgs.find((o) => o.slug === m.org)?.name ?? m.org;
  const memberships = me.memberships.map((m) => ({ ...m, orgName: orgNameOf(m) }));
  // Roster memberships carry dates, so they belong on the record alongside
  // the self-declared rows — see ExperienceManager's three-armed list.
  const experienceMemberships: OrgMembershipExperience[] = me.memberships
    .filter((m) => Boolean(m.started_on))
    .map((m) => ({
      id: m.id,
      org: m.org,
      orgName: orgNameOf(m),
      orgLogo: m.org_logo ?? null,
      orgStatus: m.org_status,
      role: m.role,
      roleLabel: m.role_label,
      title: m.title,
      description: m.description ?? "",
      started_on: m.started_on!,
      ended_on: m.ended_on ?? null,
      details_status: m.details_status ?? "confirmed",
      skills: m.skills,
    }));
  // Every dated record that carries skills, memberships included — the
  // Skills section is where time-in-practice now lives.
  const practised = aggregateSkillTime([
    ...experiences,
    ...affiliations.map((a) => ({ skills: a.skills, started_on: a.started_on, ended_on: a.ended_on })),
    ...experienceMemberships.map((m) => ({
      skills: m.skills.map((skill) => skill.skill),
      started_on: m.started_on,
      ended_on: m.ended_on,
    })),
  ]);
  const invests =
    intents.includes("invest") ||
    Boolean(profile.stage_focus?.length || profile.sector_focus?.length || profile.check_min);

  return (
    <ProfileEditorProvider initialOpen={edit && SECTIONS.includes(edit) ? edit : null}>
      <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-5">
          <NextStepStrip ladder={vitality?.ladder ?? null} />
          <IdentitySection
            profile={profile}
            email={me.email}
            actions={
              <div className="flex flex-wrap gap-2">
                {profile.handle && (
                  <Link href={`/p/${profile.handle}`} target="_blank" className={btnGhost}>
                    <Eye size={14} aria-hidden /> Preview
                  </Link>
                )}
                <ShareProfileModal
                  handle={profile.handle}
                  visibility={profile.visibility}
                  badgeEmbed={badgeEmbed}
                  badge={vitality?.badge ?? null}
                />
              </div>
            }
          />
          <AboutSection profile={profile} />
          <div id="experience" className="flex scroll-mt-24 flex-col gap-5">
            <LinkedInImport />
            <ExperienceManager
              experiences={experiences}
              affiliations={affiliations}
              memberships={experienceMemberships}
              showCapabilities={false}
              headerAside={
                <VisibilityPill
                  section="memberships"
                  value={profile.visibility?.memberships}
                  label="Experience"
                />
              }
            />
          </div>
          <SkillsSection profile={profile} practised={practised} memberships={memberships} />
          {invests && <InvestmentFocusSection profile={profile} />}
          <EmailPreferencesSection />
          <AccountSection email={me.email} />
        </div>
        <ProfileAside
          ladder={vitality?.ladder ?? null}
          cadence={vitality?.cadence ?? null}
        />
      </div>
    </ProfileEditorProvider>
  );
}
