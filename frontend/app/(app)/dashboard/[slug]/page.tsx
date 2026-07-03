import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { OrgTabs } from "./OrgTabs";

type SectionField = { id: number; key: string; value: unknown; visibility: string };
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgSummary = {
  org: { slug: string; name: string; is_fundraising: boolean; is_verified: boolean };
};

const IDENTITY_FIELD_COUNT_KINDS = ["about", "team", "products", "market_thesis"];

export default async function DashboardOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let profile: OrgSummary;
  let sections: Section[];
  try {
    [profile, sections] = await Promise.all([
      apiFetch(`/orgs/${slug}/`),
      apiFetch(`/orgs/${slug}/sections/`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
  const profileFieldCount = sections
    .filter((section) => IDENTITY_FIELD_COUNT_KINDS.includes(section.kind))
    .reduce((count, section) => count + section.fields.length, 0);
  const canPostUpdates = profileFieldCount >= 5;

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
            <Link
              href={`/dashboard/${slug}/access`}
              className="mt-2 inline-flex text-sm font-medium text-emerald-700 underline underline-offset-2"
            >
              Manage granted access
            </Link>
          </div>
        </header>

        <OrgTabs
          slug={slug}
          sections={sections}
          isFundraising={profile.org.is_fundraising}
          profileFieldCount={profileFieldCount}
          canPostUpdates={canPostUpdates}
        />
      </div>
    </div>
  );
}
