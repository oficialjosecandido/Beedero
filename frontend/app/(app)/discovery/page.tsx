import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { ENGAGEMENT_OPTIONS, EXPERTISE_OPTIONS } from "@/lib/advisory-options";
import { GEO_FILTER_HELP, GEO_FILTER_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import type { OrgSummary } from "@/lib/types";

import { AdvisorsDiscoveryList } from "./AdvisorsDiscoveryList";
import { DiscoveryList } from "./DiscoveryList";
import { PeopleDiscoveryList } from "./PeopleDiscoveryList";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
  is_following?: boolean;
};

type AdvisorSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
  expertise: string[];
  verified_gig_count: number;
};

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tab =
    params.tab === "organizations" ? "organizations" : params.tab === "advisors" ? "advisors" : "people";
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  for (const key of ["stage", "sector", "geo", "fundraising", "min_credibility", "expertise", "engagement"]) {
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

  const peopleResults: { items: PersonSummary[]; next_offset: number | null } =
    tab === "people"
      ? await apiFetch<{ items: PersonSummary[]; next_offset: number | null }>(
          `/discovery/people/?${query.toString()}`
        )
      : { items: [], next_offset: null };

  const advisorResults: { items: AdvisorSummary[]; next_offset: number | null } =
    tab === "advisors"
      ? await apiFetch<{ items: AdvisorSummary[]; next_offset: number | null }>(
          `/discovery/advisors/?${query.toString()}`
        )
      : { items: [], next_offset: null };

  const tabQuery = (nextTab: "organizations" | "people" | "advisors") => {
    const next = new URLSearchParams(query);
    next.set("tab", nextTab);
    return next.toString();
  };

  const clearSearchQuery = () => {
    const next = new URLSearchParams(query);
    next.delete("q");
    next.set("tab", tab);
    return next.toString();
  };

  const hasSearchQuery = Boolean(params.q?.trim());

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
            Discover
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
            Find people and organizations
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Search by name, then follow people or organizations to shape your feed.
          </p>
        </div>

        <form
          className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm sm:p-6"
          method="get"
        >
          <input type="hidden" name="tab" value={tab} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Search
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder={
                  tab === "people"
                    ? "Search people by name or headline…"
                    : tab === "advisors"
                      ? "Search advisors by name or headline…"
                      : "Search organizations by name…"
                }
                className="flex-1 rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
              <div className="flex gap-2">
                {hasSearchQuery && (
                  <Link
                    href={`/discovery?${clearSearchQuery()}`}
                    className="rounded-xl border border-beedero-border px-5 py-2 text-sm font-semibold text-beedero-black/70 hover:bg-zinc-50"
                  >
                    Clear
                  </Link>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
                >
                  Search
                </button>
              </div>
            </div>
          </label>
        </form>

        <div className="flex gap-2">
          <Link
            href={`/discovery?${tabQuery("people")}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "people"
                ? "bg-beedero-black text-beedero-yellow"
                : "bg-beedero-white text-beedero-black/70 ring-1 ring-beedero-black/10 hover:bg-beedero-yellow/20"
            }`}
          >
            People
          </Link>
          <Link
            href={`/discovery?${tabQuery("organizations")}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "organizations"
                ? "bg-beedero-black text-beedero-yellow"
                : "bg-beedero-white text-beedero-black/70 ring-1 ring-beedero-black/10 hover:bg-beedero-yellow/20"
            }`}
          >
            Organizations
          </Link>
          <Link
            href={`/discovery?${tabQuery("advisors")}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "advisors"
                ? "bg-beedero-black text-beedero-yellow"
                : "bg-beedero-white text-beedero-black/70 ring-1 ring-beedero-black/10 hover:bg-beedero-yellow/20"
            }`}
          >
            Advisors
          </Link>
        </div>

        {tab === "people" ? (
          <PeopleDiscoveryList
            initialItems={peopleResults.items}
            initialNextOffset={peopleResults.next_offset}
            query={query.toString()}
          />
        ) : tab === "advisors" ? (
          <>
            <form
              className="grid gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              method="get"
            >
              <input type="hidden" name="tab" value="advisors" />
              {params.q && <input type="hidden" name="q" value={params.q} />}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Expertise
                <select
                  name="expertise"
                  defaultValue={params.expertise ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {EXPERTISE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Engagement
                <select
                  name="engagement"
                  defaultValue={params.engagement ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {ENGAGEMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Stage
                <select
                  name="stage"
                  defaultValue={params.stage ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Sector
                <select
                  name="sector"
                  defaultValue={params.sector ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {SECTOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="self-end rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
              >
                Filter
              </button>
            </form>

            <AdvisorsDiscoveryList
              initialItems={advisorResults.items}
              initialNextOffset={advisorResults.next_offset}
              query={query.toString()}
            />
          </>
        ) : (
          <>
            <form
              className="grid gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
              method="get"
            >
              <input type="hidden" name="tab" value="organizations" />
              {params.q && <input type="hidden" name="q" value={params.q} />}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Stage
                <select
                  name="stage"
                  defaultValue={params.stage ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Sector
                <select
                  name="sector"
                  defaultValue={params.sector ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {SECTOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                {GEO_FILTER_LABEL}
                <select
                  name="geo"
                  defaultValue={params.geo ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  {GEO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-zinc-400">{GEO_FILTER_HELP}</span>
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-beedero-border px-3 py-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  name="fundraising"
                  value="true"
                  defaultChecked={params.fundraising === "true"}
                  className="size-4 accent-beedero-black"
                />
                Fundraising
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Min. credibility
                <select
                  name="min_credibility"
                  defaultValue={params.min_credibility ?? ""}
                  className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                >
                  <option value="">Any</option>
                  <option value="1">Level 1+</option>
                  <option value="2">Level 2+</option>
                  <option value="3">Level 3+</option>
                  <option value="4">Level 4</option>
                </select>
              </label>
              <button
                type="submit"
                className="self-end rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
              >
                Filter
              </button>
            </form>

            {(orgResults.active_this_week?.length ?? 0) > 0 && !hasSearchQuery && (
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-950">Active this week</h2>
                  <p className="text-sm text-zinc-600">
                    Organizations that published recently, ranked by credibility.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {orgResults.active_this_week!.map((org) => (
                    <Link
                      key={org.slug}
                      href={`/org/${org.slug}`}
                      className="rounded-2xl border-2 border-emerald-700/30 bg-emerald-50/60 px-4 py-3 shadow-sm transition hover:border-emerald-700"
                    >
                      <p className="font-semibold text-zinc-950">{org.name}</p>
                      {org.one_liner && <p className="mt-1 text-xs text-zinc-600">{org.one_liner}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <DiscoveryList
              initialItems={orgResults.items}
              initialNextOffset={orgResults.next_offset}
              query={query.toString()}
            />
          </>
        )}
      </div>
    </main>
  );
}
