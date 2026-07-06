import Link from "next/link";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["stage", "sector", "geo", "fundraising"]) {
    if (params[key]) query.set(key, params[key]!);
  }

  const orgs: OrgSummary[] = await apiFetch(`/discovery/?${query.toString()}`);

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
          <button
            type="submit"
            className="self-end rounded-xl bg-beedero-yellow px-5 py-2 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
          >
            Filter
          </button>
        </form>

        <div className="grid w-full gap-3">
        {orgs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-beedero-black/20 bg-beedero-white p-8 text-sm text-zinc-500">
            No results.
          </div>
        )}
        {orgs.map((org) => (
          <Link
            key={org.slug}
            href={`/org/${org.slug}`}
            className="flex flex-col gap-4 rounded-2xl border border-beedero-black/10 bg-beedero-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-beedero-yellow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              {org.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logo} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-500">
                  {org.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-medium text-zinc-950">{org.name}</p>
                  <p className="text-xs text-zinc-400">@{org.slug}</p>
                </div>
                {org.one_liner && <p className="text-xs text-zinc-600">{org.one_liner}</p>}
                <p className="text-xs text-zinc-500">
                  {org.stage} · {org.sector} · {org.geo}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {org.is_verified && (
                <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-xs font-bold text-beedero-black">
                  Verified
                </span>
              )}
              {org.is_fundraising && (
                <span className="rounded-full bg-beedero-black px-2 py-0.5 text-xs font-bold text-beedero-yellow">
                  Fundraising
                </span>
              )}
            </div>
          </Link>
        ))}
        </div>
      </div>
    </main>
  );
}
