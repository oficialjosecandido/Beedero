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
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold">Discovery</h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
          Stage
          <input
            name="stage"
            defaultValue={params.stage ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Setor
          <input
            name="sector"
            defaultValue={params.sector ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Geografia
          <input
            name="geo"
            defaultValue={params.geo ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="fundraising"
            value="true"
            defaultChecked={params.fundraising === "true"}
          />
          Em ronda
        </label>
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Filtrar
        </button>
      </form>

      <div className="grid w-full max-w-3xl gap-3">
        {orgs.length === 0 && (
          <p className="text-sm text-zinc-500">Sem resultados.</p>
        )}
        {orgs.map((org) => (
          <Link
            key={org.slug}
            href={`/org/${org.slug}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
          >
            <div>
              <p className="font-medium">{org.name}</p>
              <p className="text-xs text-zinc-500">
                {org.stage} · {org.sector} · {org.geo}
              </p>
            </div>
            <div className="flex gap-2">
              {org.is_verified && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  Verificada
                </span>
              )}
              {org.is_fundraising && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  Em ronda
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
