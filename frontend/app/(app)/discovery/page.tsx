import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

import { DiscoveryList } from "./DiscoveryList";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["stage", "sector", "geo", "fundraising", "min_credibility"]) {
    if (params[key]) query.set(key, params[key]!);
  }

  const { items, next_offset }: { items: OrgSummary[]; next_offset: number | null } =
    await apiFetch(`/discovery/?${query.toString()}`);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
            Discovery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Find startups worth a closer look
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Filter by stage, sector, geography, and fundraising status.
          </p>
        </div>

        <form
          className="grid gap-4 rounded-3xl border border-beedero-black/10 bg-beedero-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
          method="get"
        >
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
              <option value="1">Nível 1+</option>
              <option value="2">Nível 2+</option>
              <option value="3">Nível 3+</option>
              <option value="4">Nível 4</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
          >
            Filter
          </button>
        </form>

        <DiscoveryList initialItems={items} initialNextOffset={next_offset} query={query.toString()} />
      </div>
    </main>
  );
}
