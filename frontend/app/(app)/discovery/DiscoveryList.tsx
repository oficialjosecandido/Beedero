"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { EmptyPanel, Seal } from "@/components/app-shell/ui";
import { geoLabel, sectorLabel, stageLabel } from "@/lib/org-filters";
import type { OrgSummary } from "@/lib/types";

import { loadMoreDiscoveryAction } from "./actions";

function OrgCard({ org }: { org: OrgSummary }) {
  const detail = org.one_liner || (org.sector ? sectorLabel(org.sector) : null);
  const meta = [
    org.stage ? stageLabel(org.stage) : null,
    org.geo ? geoLabel(org.geo) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/o/${org.slug}`}
      className="group flex items-start gap-4 border border-white/10 bg-white/[0.025] p-5 transition hover:border-beedero-yellow/50"
    >
      {org.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logo}
          alt=""
          className="size-12 shrink-0 object-cover [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center bg-[#2a2f3a] text-2xl font-black text-white [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]"
        >
          {org.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-bold">{org.name}</h2>
          {org.is_verified && <Seal />}
        </div>
        {detail && <p className="mt-1 text-sm text-white/65">{detail}</p>}
        {meta && <p className="mt-3 text-xs text-white/40">{meta}</p>}
      </div>
      <span className="text-beedero-yellow opacity-0 transition group-hover:opacity-100" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function DiscoveryList({
  initialItems,
  initialNextOffset,
  query,
}: {
  initialItems: OrgSummary[];
  initialNextOffset: number | null;
  query: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (nextOffset === null) return;
    startTransition(async () => {
      try {
        const next = await loadMoreDiscoveryAction(query, nextOffset);
        setItems((prev) => [...prev, ...next.items]);
        setNextOffset(next.next_offset);
        setError(null);
      } catch {
        setError("Could not load more results.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <EmptyPanel>
        {query.trim()
          ? "No organisations match these filters. Try a wider search."
          : "No organisations to show yet. Check back as more join Beedero."}
      </EmptyPanel>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((org) => (
        <OrgCard key={org.slug} org={org} />
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="col-span-full mx-auto mt-2 flex items-center gap-2 border border-white/15 px-6 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:cursor-default disabled:opacity-40"
        >
          {isPending && (
            <i className="size-3 animate-spin rounded-full border-2 border-white/20 border-t-beedero-yellow" />
          )}
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="col-span-full text-center text-sm text-beedero-yellow">{error}</p>}
    </div>
  );
}
