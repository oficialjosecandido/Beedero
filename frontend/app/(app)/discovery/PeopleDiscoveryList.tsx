"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { followUserAction } from "@/app/(app)/dashboard/actions";

import { loadMorePeopleDiscoveryAction } from "./actions";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
};

function PersonCard({ person }: { person: PersonSummary }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        {person.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
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
          {person.headline && <p className="text-xs text-zinc-500">{person.headline}</p>}
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("user_id", String(person.id));
            await followUserAction(formData);
          })
        }
        className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-beedero-yellow disabled:opacity-50"
      >
        {pending ? "Following…" : "Follow"}
      </button>
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
    return (
      <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
        No people found. Try a different search.
      </div>
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
          className="mx-auto rounded-full border border-beedero-border bg-beedero-white px-6 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20 disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
