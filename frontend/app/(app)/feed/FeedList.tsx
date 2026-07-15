"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatDate } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/types";

import { loadMoreFeedAction } from "./actions";
import { CommentThread } from "./CommentThread";
import { ReactionBar } from "./ReactionBar";
import type { FeedItem } from "./types";

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {item.type === "org" && item.org ? (
          <Link
            href={`/org/${item.org.slug}`}
            className="flex items-center gap-2 font-semibold text-zinc-950 hover:underline hover:decoration-beedero-yellow hover:decoration-2 hover:underline-offset-4"
          >
            {item.org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.org.logo} alt="" className="size-8 rounded-lg object-cover" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500">
                {item.org.name.charAt(0).toUpperCase()}
              </span>
            )}
            {item.org.name}
          </Link>
        ) : (
          <span className="font-semibold text-zinc-950">{item.author?.name ?? "Someone"}</span>
        )}
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
          {SECTION_LABELS[item.kind] ?? item.kind}
        </span>
      </div>
      <h2 className="mt-4 text-lg font-extrabold">{item.value.title ?? "Update"}</h2>
      {item.value.body && <p className="mt-2 text-sm leading-6 text-zinc-600">{item.value.body}</p>}
      {item.value.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.value.image}
          alt=""
          className="mt-3 max-h-96 w-full rounded-2xl object-cover"
        />
      )}
      {item.value.occurred_at && (
        <p className="mt-4 text-xs text-zinc-400">{formatDate(item.value.occurred_at)}</p>
      )}
      <ReactionBar
        activityId={item.id}
        initialCount={item.reaction_count}
        initialCounts={item.reaction_counts}
        initialReaction={item.viewer_reaction}
      />
      <CommentThread activityId={item.id} initialCount={item.comment_count} />
    </article>
  );
}

export function FeedList({
  initialItems,
  initialCursor,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      try {
        const next = await loadMoreFeedAction(cursor);
        setItems((prev) => [...prev, ...next.items]);
        setCursor(next.next_cursor);
        setError(null);
      } catch {
        setError("Could not load more updates.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
        No updates yet. Share an update above, follow people or organizations from Discover, or
        publish from an organization you manage.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <FeedCard key={`${item.type}-${item.id}`} item={item} />
      ))}
      {cursor && (
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
