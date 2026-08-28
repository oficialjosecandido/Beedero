import Link from "next/link";

import { CredibilityBadge } from "@/components/CredibilityBadge";
import { geoLabel, sectorLabel, stageLabel } from "@/lib/org-filters";
import type { OrgSummary } from "@/lib/types";

function StartupCard({ org }: { org: OrgSummary }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/o/${org.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        {org.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy"
            src={org.logo}
            alt={`${org.name} logo`}
            className="size-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-500">
            {org.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <h2 className="font-medium text-zinc-950">{org.name}</h2>
            <p className="text-xs text-subtle">@{org.slug}</p>
          </div>
          {org.one_liner && <p className="text-xs text-zinc-600">{org.one_liner}</p>}
          <p className="text-xs text-zinc-500">
            {org.stage ? stageLabel(org.stage) : "—"} ·{" "}
            {org.sector ? sectorLabel(org.sector) : "—"} · {org.geo ? geoLabel(org.geo) : "—"}
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <CredibilityBadge level={org.credibility_level ?? 0} />
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
    </article>
  );
}

export function StartupDirectory({
  items,
  page,
  totalPages,
  queryString,
}: {
  items: OrgSummary[];
  page: number;
  totalPages: number;
  queryString: string;
}) {
  const pageLink = (nextPage: number) => {
    const params = new URLSearchParams(queryString);
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/startups?${qs}` : "/startups";
  };

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
        No startups to show yet — check back as more join Beedero.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid w-full gap-3">
        {items.map((org) => (
          <StartupCard key={org.slug} org={org} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Startup directory pagination"
          className="flex flex-wrap items-center justify-center gap-3 text-sm"
        >
          {page > 1 && (
            <Link
              href={pageLink(page - 1)}
              className="rounded-full border border-beedero-border px-4 py-2 font-semibold text-beedero-black hover:bg-beedero-yellow/20"
            >
              Previous
            </Link>
          )}
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageLink(page + 1)}
              className="rounded-full border border-beedero-border px-4 py-2 font-semibold text-beedero-black hover:bg-beedero-yellow/20"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
