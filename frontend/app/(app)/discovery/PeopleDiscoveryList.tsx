"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { sendConnectionRequestAction } from "@/app/(app)/connections/actions";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatAtHandle } from "@/lib/handles";

import { loadMorePeopleDiscoveryAction } from "./actions";

type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
  connection_status?: ConnectionStatus;
};

function PersonCard({ person }: { person: PersonSummary }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<ConnectionStatus>(person.connection_status ?? "none");
  const [error, setError] = useState<string | null>(null);

  function connect() {
    if (status !== "none") return;
    startTransition(async () => {
      setError(null);
      const result = await sendConnectionRequestAction(person.id, "");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus("pending_sent");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {person.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy"
            src={person.profile_picture}
            alt=""
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
            {person.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {person.handle ? (
              <Link href={`/p/${person.handle}`} className="font-medium text-zinc-950 hover:underline">
                {person.name}
              </Link>
            ) : (
              <p className="font-medium text-zinc-950">{person.name}</p>
            )}
            {person.is_verified && (
              <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-[10px] font-bold text-beedero-black">
                Verified
              </span>
            )}
          </div>
          {person.handle && (
            <p className="text-xs font-medium text-zinc-500">{formatAtHandle(person.handle)}</p>
          )}
          {person.headline && <p className="text-xs text-zinc-500">{person.headline}</p>}
        </div>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        {status === "connected" ? (
          <span className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-semibold text-zinc-600">
            Connected
          </span>
        ) : status === "pending_sent" ? (
          <span className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-semibold text-zinc-600">
            Request sent
          </span>
        ) : status === "pending_received" ? (
          <Link
            href="/network"
            className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-beedero-yellow"
          >
            Respond to request
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={connect}
            className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-beedero-yellow disabled:opacity-50"
          >
            {pending ? "Connecting…" : "Connect"}
          </button>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

export function PeopleDiscoveryList({
  initialItems,
  initialNextOffset,
  query,
}: {
  initialItems: PersonSummary[];
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
        const next = await loadMorePeopleDiscoveryAction(query, nextOffset);
        setItems((prev) => [...prev, ...next.items]);
        setNextOffset(next.next_offset);
        setError(null);
      } catch {
        setError("Could not load more results.");
      }
    });
  }

  if (items.length === 0) {
    return query.trim() ? (
      <EmptyState title="No people found" description="Try a different search." />
    ) : (
      <EmptyState
        title="No one to show yet"
        description="Check back as more investors and founders join — meanwhile, catch up on the feed."
        action={{ href: "/feed", label: "Browse the feed" }}
      />
    );
  }

  return (
    <div className="grid w-full gap-3">
      {items.map((person) => (
        <PersonCard key={person.id} person={person} />
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
