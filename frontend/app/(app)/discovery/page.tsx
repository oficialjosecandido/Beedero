import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, btnOutlineYellow } from "@/components/app-shell/ui";
import { DiscoveryFilters } from "@/components/discovery/DiscoveryFilters";
import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

import { DiscoveryList } from "./DiscoveryList";
import { PeopleDiscoveryList } from "./PeopleDiscoveryList";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  city?: string;
  profile_picture?: string | null;
  connection_status?: "none" | "pending_sent" | "pending_received" | "connected";
};

type CitySummary = { city: string; city_key: string; count: number } | null;

type PeopleResponse = {
  items: PersonSummary[];
  next_offset: number | null;
  city_summary?: CitySummary;
  /** The viewer's own side of the ladder's gate (rungs 1–4). */
  viewer?: { unlocked: boolean; steps_left: number };
};

/** Only people past rungs 1–4 are listed — including, until then, not you. */
function NotListedYet({ stepsLeft }: { stepsLeft: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 border border-beedero-yellow/40 bg-beedero-yellow/[0.06] px-4 py-3">
      <p className="min-w-0 flex-1 text-xs leading-5 text-white/75">
        <b className="block text-sm text-white">You&apos;re not in Discover yet.</b>
        {stepsLeft} {stepsLeft === 1 ? "step" : "steps"} left on your profile — then people can find
        you here, and you can ask to connect.
      </p>
      <Link
        href="/profile"
        className="min-h-11 shrink-0 content-center bg-beedero-yellow px-4 text-xs font-black text-beedero-black"
      >
        Finish my profile
      </Link>
    </div>
  );
}

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  // People first in Looking for — organisations only when explicitly asked.
  const tab = params.tab === "organizations" ? "organizations" : "people";
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  for (const key of ["stage", "sector", "geo", "fundraising", "min_credibility"]) {
    if (params[key]) query.set(key, params[key]!);
  }

  const orgResults: {
    items: OrgSummary[];
    next_offset: number | null;
    active_this_week?: OrgSummary[];
  } =
    tab === "organizations"
      ? await apiFetch<{
          items: OrgSummary[];
          next_offset: number | null;
          active_this_week?: OrgSummary[];
        }>(`/discovery/?${query.toString()}`)
      : { items: [], next_offset: null, active_this_week: [] };

  const peopleResults: PeopleResponse =
    tab === "people"
      ? await apiFetch<PeopleResponse>(`/discovery/people/?${query.toString()}`)
      : { items: [], next_offset: null };

  const resultCount = tab === "people" ? peopleResults.items.length : orgResults.items.length;
  const hasMore =
    tab === "people" ? peopleResults.next_offset !== null : orgResults.next_offset !== null;

  return (
    <>
      <PageHeading
        eyebrow="Network directory"
        title="Find the signal."
        actions={
          <button type="button" className={`${btnOutlineYellow} uppercase`} disabled title="Coming soon">
            Saved search
          </button>
        }
      />

      <Suspense fallback={null}>
        <DiscoveryFilters resultCount={resultCount} hasMore={hasMore} />
      </Suspense>

      {tab === "people" && peopleResults.viewer && !peopleResults.viewer.unlocked && (
        <NotListedYet stepsLeft={peopleResults.viewer.steps_left} />
      )}

      {tab === "people" ? (
        <PeopleDiscoveryList
          key={`people-${query.toString()}`}
          initialItems={peopleResults.items}
          initialNextOffset={peopleResults.next_offset}
          query={query.toString()}
        />
      ) : (
        <DiscoveryList
          key={`orgs-${query.toString()}`}
          initialItems={orgResults.items}
          initialNextOffset={orgResults.next_offset}
          query={query.toString()}
        />
      )}
    </>
  );
}
