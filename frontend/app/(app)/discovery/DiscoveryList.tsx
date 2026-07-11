"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { CredibilityBadge } from "@/components/CredibilityBadge";
import type { OrgSummary } from "@/lib/types";

import { loadMoreDiscoveryAction } from "./actions";

function OrgCard({ org }: { org: OrgSummary }) {
  return (
    <Link
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
      <div className="rounded-3xl border border-dashed border-beedero-black/20 bg-beedero-white p-8 text-sm text-zinc-500">
        No results.
      </div>
    );
  }

  return (
    <div className="grid w-full gap-3">
      {items.map((org) => (
        <OrgCard key={org.slug} org={org} />
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mx-auto rounded-full border border-beedero-black/20 bg-beedero-white px-6 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20 disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
