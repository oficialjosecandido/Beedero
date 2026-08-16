"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { expertiseLabel } from "@/lib/advisory-options";
import { formatAtHandle } from "@/lib/handles";

import { loadMoreAdvisorsDiscoveryAction } from "./actions";

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

function AdvisorCard({ advisor }: { advisor: AdvisorSummary }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {advisor.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={advisor.profile_picture} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
            {advisor.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {advisor.handle ? (
              <Link href={`/p/${advisor.handle}`} className="font-medium text-zinc-950 hover:underline">
                {advisor.name}
              </Link>
            ) : (
              <p className="font-medium text-zinc-950">{advisor.name}</p>
            )}
            {advisor.is_verified && (
              <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-[10px] font-bold text-beedero-black">
                Verified
              </span>
            )}
            {advisor.verified_gig_count > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                {advisor.verified_gig_count} verified role{advisor.verified_gig_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {advisor.handle && <p className="text-xs font-medium text-zinc-500">{formatAtHandle(advisor.handle)}</p>}
          {advisor.headline && <p className="text-xs text-zinc-500">{advisor.headline}</p>}
          {advisor.expertise.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {advisor.expertise.map((value) => (
                <span
                  key={value}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                >
                  {expertiseLabel(value)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdvisorsDiscoveryList({
  initialItems,
  initialNextOffset,
  query,
}: {
  initialItems: AdvisorSummary[];
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
        const next = await loadMoreAdvisorsDiscoveryAction(query, nextOffset);
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
      <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
        {query.trim()
          ? "No advisors found. Try a different search."
          : "No advisors to show yet — check back as more join Beedero."}
      </div>
    );
  }

  return (
    <div className="grid w-full gap-3">
      {items.map((advisor) => (
        <AdvisorCard key={advisor.id} advisor={advisor} />
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mx-auto rounded-full border border-beedero-border bg-beedero-white px-6 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20 disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
