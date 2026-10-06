"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { EmptyPanel, Initials, Seal } from "@/components/app-shell/ui";

import { loadMorePeopleDiscoveryAction } from "./actions";

type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  city?: string;
  profile_picture?: string | null;
  connection_status?: ConnectionStatus;
};

function PersonCard({ person }: { person: PersonSummary }) {
  const href = person.handle ? `/p/${person.handle}` : null;
  const detail = person.headline || null;
  const footer = person.city || null;

  const inner = (
    <>
      {person.profile_picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={person.profile_picture}
          alt=""
          className="size-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Initials name={person.name} className="size-12 text-sm" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-bold">{person.name}</h2>
          {person.is_verified && <Seal />}
        </div>
        {detail && <p className="mt-1 text-sm text-white/65">{detail}</p>}
        {footer && <p className="mt-3 text-xs text-white/40">{footer}</p>}
      </div>
      <span className="text-beedero-yellow opacity-0 transition group-hover:opacity-100" aria-hidden>
        →
      </span>
    </>
  );

  const className =
    "group flex items-start gap-4 border border-white/10 bg-white/[0.025] p-5 transition hover:border-beedero-yellow/50";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <article className={className}>{inner}</article>;
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
    return (
      <EmptyPanel>
        {query.trim()
          ? "No people match these filters. Try a wider search."
          : "No one to show yet. Check back as more founders and investors join."}
      </EmptyPanel>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((person) => (
        <PersonCard key={person.id} person={person} />
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
