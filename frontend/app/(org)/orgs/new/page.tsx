import { redirect } from "next/navigation";

import { OrgWorkspaceHeader } from "@/components/org-workspace/OrgWorkspaceHeader";
import { ApiError, apiFetch } from "@/lib/api";
import type { CofounderMatch } from "@/lib/cofounder-options";
import type { ProfileSwitcherMe } from "@/lib/profile-switcher-client";
import { pageMetadata } from "@/lib/site-metadata";

import { OrgOnboardingForm, type MatchContext } from "./OrgOnboardingForm";

export const metadata = pageMetadata({
  title: "New organisation",
  description: "Create your organisation on Beedero.",
  path: "/orgs/new",
});

/**
 * `?match=<id>` — the organisation comes from a co-founder match, so the
 * other person is invited as an owner once it exists. The name is read from
 * the person's own matches rather than the URL: a stranger's id resolves to
 * nothing and the page is the ordinary one, and the backend checks the match
 * again before anything is created.
 */
async function matchContext(id: string | undefined): Promise<MatchContext | null> {
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) return null;
  try {
    const { results } = await apiFetch<{ results: CofounderMatch[] }>("/cofounder/matches/");
    const match = results.find((item) => item.id === matchId && item.org === null);
    return match ? { id: match.id, otherName: match.other.name } : null;
  } catch {
    return null;
  }
}

/**
 * Creating an organisation: one page, checkout at the end. The basics, the
 * plan, an optional code and the terms — then either the workspace (a code
 * gave the free year) or Stripe Checkout. Everything else (logo, about,
 * team) is added later from the workspace, where the verification ladder
 * asks for it.
 */
export default async function NewOrganisationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  let me: ProfileSwitcherMe;
  try {
    me = await apiFetch<ProfileSwitcherMe>("/auth/me/");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const { match } = await searchParams;

  return (
    <main className="min-h-screen bg-org-ground text-org-ink">
      <OrgWorkspaceHeader personName={me.investor_profile?.full_name || me.email} />
      <OrgOnboardingForm match={await matchContext(match)} />
    </main>
  );
}
