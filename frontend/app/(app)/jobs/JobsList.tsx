"use client";

import { useState, useTransition } from "react";

import { EmptyPanel } from "@/components/app-shell/ui";
import { JobCard } from "@/components/jobs/JobCard";
import type { JobSummary } from "@/lib/types";

import { loadMoreJobsAction } from "./actions";

export function JobsList({
  initialItems,
  initialNextOffset,
  query,
  hasFilters,
}: {
  initialItems: JobSummary[];
  initialNextOffset: number | null;
  query: string;
  hasFilters: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (nextOffset === null) return;
    startTransition(async () => {
      try {
        const next = await loadMoreJobsAction(query, nextOffset);
        setItems((prev) => [...prev, ...next.items]);
        setNextOffset(next.next_offset);
        setError(null);
      } catch {
        setError("Could not load more opportunities.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <EmptyPanel>
        {hasFilters
          ? "No opportunities match these filters."
          : "No opportunities yet. Verified organisations publish their open roles here."}
      </EmptyPanel>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}

      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mx-auto mt-2 flex items-center gap-2 border border-white/15 px-6 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:cursor-default disabled:opacity-40"
        >
          {isPending && (
            <i className="size-3 animate-spin rounded-full border-2 border-white/20 border-t-beedero-yellow" />
          )}
          {isPending ? "Loading more opportunities" : "Load more"}
        </button>
      )}

      {error && <p className="text-center text-sm text-beedero-yellow">{error}</p>}
    </div>
  );
}
