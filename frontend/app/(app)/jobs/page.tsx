import { apiFetch } from "@/lib/api";
import { ENGAGEMENT_TYPE_OPTIONS, LOCATION_TYPE_OPTIONS } from "@/lib/job-options";
import type { JobSummary } from "@/lib/types";

import { JobsList } from "./JobsList";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  for (const key of ["type", "location", "skills"]) {
    if (params[key]) query.set(key, params[key]!);
  }
  if (params.verified === "true") query.set("verified", "true");

  const results = await apiFetch<{ items: JobSummary[]; next_offset: number | null }>(
    `/jobs/?${query.toString()}`
  );

  const hasSearchQuery = Boolean(params.q?.trim());

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">Jobs</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
            Find your next role
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Open roles at organizations building on Beedero.
          </p>
        </div>

        <form
          className="grid gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
          method="get"
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Search
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search jobs by title…"
              className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Type
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            >
              <option value="">Any</option>
              {ENGAGEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Location
            <select
              name="location"
              defaultValue={params.location ?? ""}
              className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            >
              <option value="">Any</option>
              {LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Skill
            <input
              name="skills"
              defaultValue={params.skills ?? ""}
              placeholder="e.g. React"
              className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-beedero-border px-3 py-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              name="verified"
              value="true"
              defaultChecked={params.verified === "true"}
              className="size-4 accent-beedero-black"
            />
            Verified orgs
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
          >
            Filter
          </button>
        </form>

        <JobsList
          initialItems={results.items}
          initialNextOffset={results.next_offset}
          query={query.toString()}
          hasSearchQuery={hasSearchQuery}
        />
      </div>
    </main>
  );
}
