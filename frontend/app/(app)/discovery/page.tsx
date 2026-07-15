import Link from "next/link";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

import { DiscoveryList } from "./DiscoveryList";
import { PeopleDiscoveryList } from "./PeopleDiscoveryList";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  profile_picture?: string | null;
};

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tab = params.tab === "people" ? "people" : "organizations";
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  for (const key of ["stage", "sector", "geo", "fundraising", "min_credibility"]) {
    if (params[key]) query.set(key, params[key]!);
  }

  const orgResults: { items: OrgSummary[]; next_offset: number | null } =
    tab === "organizations"
      ? await apiFetch(`/discovery/?${query.toString()}`)
      : { items: [], next_offset: null };

  const peopleResults: { items: PersonSummary[]; next_offset: number | null } =
    tab === "people"
      ? await apiFetch(`/discovery/people/?${query.toString()}`)
      : { items: [], next_offset: null };

  const tabQuery = (nextTab: "organizations" | "people") => {
    const next = new URLSearchParams(query);
    next.set("tab", nextTab);
    return next.toString();
  };

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
            Discover
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Find people and organizations
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Search by name, then follow people or organizations to shape your feed.
          </p>
        </div>

        <form
          className="rounded-3xl border border-beedero-black/10 bg-beedero-white p-4 shadow-sm sm:p-6"
          method="get"
        >
          <input type="hidden" name="tab" value={tab} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Search
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder={tab === "people" ? "Search people by name or headline…" : "Search organizations by name…"}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
              <button
                type="submit"
                className="rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
              >
                Search
              </button>
            </div>
          </label>
        </form>

        <div className="flex gap-2">
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
            href={`/discovery?${tabQuery("people")}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "people"
                ? "bg-beedero-black text-beedero-yellow"
                : "bg-beedero-white text-beedero-black/70 ring-1 ring-beedero-black/10 hover:bg-beedero-yellow/20"
            }`}
          >
            People
          </Link>
        </div>

        {tab === "people" ? (
          <PeopleDiscoveryList
            initialItems={peopleResults.items}
            initialNextOffset={peopleResults.next_offset}
            query={query.toString()}
          />
        ) : (
          <>
            <form
              className="grid gap-4 rounded-3xl border border-beedero-black/10 bg-beedero-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
              method="get"
            >
              <input type="hidden" name="tab" value="organizations" />
              {params.q && <input type="hidden" name="q" value={params.q} />}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Stage
                <input
                  name="stage"
                  defaultValue={params.stage ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Sector
                <input
                  name="sector"
                  defaultValue={params.sector ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Geography
                <input
                  name="geo"
                  defaultValue={params.geo ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700">
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
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
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
