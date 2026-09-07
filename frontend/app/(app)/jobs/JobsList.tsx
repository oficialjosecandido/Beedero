"use client";

import { useState, useTransition } from "react";

import { EmptyState } from "@/components/EmptyState";
import { JobCard } from "@/components/jobs/JobCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { JobSummary } from "@/lib/types";

import { loadMoreJobsAction } from "./actions";

export function JobsList({
  initialItems,
  initialNextOffset,
  query,
  hasSearchQuery,
}: {
  initialItems: JobSummary[];
  initialNextOffset: number | null;
  query: string;
  hasSearchQuery: boolean;
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
        setError("Could not load more jobs.");
      }
    });
  }

  if (items.length === 0) {
    return hasSearchQuery ? (
      <EmptyState title="No jobs found" description="Try a different search or filters." />
    ) : (
      <EmptyState
        title="No jobs to show yet"
        description="Check back as more organizations publish openings."
      />
    );
  }

  return (
    <div className="grid w-full gap-3">
      {items.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mx-auto flex items-center gap-2 rounded-full border border-beedero-border bg-beedero-white px-6 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20 disabled:opacity-50"
        >
          {isPending && <LoadingSpinner className="size-4" label="" />}
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
