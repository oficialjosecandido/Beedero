"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatDate, formatDateTime } from "@/lib/format";
import { formatAtHandle } from "@/lib/handles";
import { SECTION_LABELS } from "@/lib/types";

import { loadMoreFeedAction } from "./actions";
import { CommentThread } from "./CommentThread";
import { EventParticipationBar } from "@/components/EventParticipationBar";
import { LinkPreviewCard } from "@/components/LinkPreviewCard";
import { RichText } from "@/components/RichText";
import { ReactionBar } from "./ReactionBar";
import type { FeedItem } from "./types";

const BODY_TRUNCATE_THRESHOLD = 220;

function FeedCard({ item }: { item: FeedItem }) {
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const isLongBody = (item.value.body?.length ?? 0) > BODY_TRUNCATE_THRESHOLD;

  const dateLabel =
    item.kind === "events" && item.value.occurred_at && item.value.ends_at
      ? `${formatDateTime(item.value.occurred_at)} – ${formatDateTime(item.value.ends_at)}`
      : item.value.occurred_at
        ? formatDate(item.value.occurred_at)
        : null;

  const name = item.type === "org" && item.org ? item.org.name : item.author?.name ?? "Someone";
  const pictureUrl = item.type === "org" && item.org ? item.org.logo : item.author?.profile_picture;
  const subtitle =
    item.type === "org"
      ? SECTION_LABELS[item.kind] ?? item.kind
      : item.author?.headline || (SECTION_LABELS[item.kind] ?? item.kind);

  const avatar = pictureUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pictureUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
      {name.charAt(0).toUpperCase()}
    </span>
  );

  const atHandle =
    item.type === "org" && item.org
      ? formatAtHandle(item.org.slug)
      : formatAtHandle(item.author?.handle);

  const nameBlock = (
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold text-zinc-950">{name}</p>
      {atHandle && <p className="truncate text-xs font-medium text-zinc-500">{atHandle}</p>}
      {subtitle && !atHandle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
      {subtitle && atHandle && item.type === "person" && (
        <p className="truncate text-xs text-zinc-500">{subtitle}</p>
      )}
      {dateLabel && <p className="text-xs text-zinc-400">{dateLabel}</p>}
    </div>
  );

  return (
    <article className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      {item.type === "org" && item.org ? (
        <Link href={`/org/${item.org.slug}`} className="flex items-start gap-3 hover:opacity-90">
          {avatar}
          {nameBlock}
        </Link>
      ) : item.author?.handle ? (
        <Link href={`/p/${item.author.handle}`} className="flex items-start gap-3 hover:opacity-90">
          {avatar}
          {nameBlock}
        </Link>
      ) : (
        <div className="flex items-start gap-3">
          {avatar}
          {nameBlock}
        </div>
      )}
      <h2 className="mt-3 text-base font-bold">{item.value.title ?? "Update"}</h2>
      {item.value.body && (
        <>
          <p
            className={`mt-1.5 text-sm leading-5 text-zinc-600 ${
              !bodyExpanded && isLongBody ? "line-clamp-3" : ""
            }`}
          >
            <RichText body={item.value.body} mentions={item.value.mentions} />
          </p>
          {isLongBody && (
            <button
              type="button"
              onClick={() => setBodyExpanded((value) => !value)}
              className="mt-0.5 text-xs font-semibold text-zinc-500 hover:text-beedero-black hover:underline"
            >
              {bodyExpanded ? "See less" : "…see more"}
            </button>
          )}
          <LinkPreviewCard body={item.value.body} />
        </>
      )}
      {item.value.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.value.image}
          alt=""
          className="mt-3 max-h-72 w-full rounded-xl object-cover"
        />
      )}
      {item.kind === "events" && item.value.payload && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          {typeof item.value.payload.format === "string" && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold uppercase">
              {item.value.payload.format.replace("_", " ")}
            </span>
          )}
          {typeof item.value.payload.location === "string" && item.value.payload.location && (
            <span>{item.value.payload.location}</span>
          )}
          {typeof item.value.payload.registration_url === "string" && (
            <a
              href={item.value.payload.registration_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              Register
            </a>
          )}
        </div>
      )}
      {(item.kind === "milestones" || item.kind === "milestone") &&
        typeof item.value.payload?.category === "string" && (
        <span className="mt-3 inline-flex rounded-full bg-beedero-yellow/40 px-2.5 py-1 text-xs font-bold uppercase text-beedero-black">
          {item.value.payload.category}
        </span>
      )}
      {item.kind === "events" && (
        <EventParticipationBar
          activityId={item.id}
          initialParticipating={item.viewer_participation === "going"}
        />
      )}
      <ReactionBar
        activityId={item.id}
        initialCount={item.reaction_count}
        initialCounts={item.reaction_counts}
        initialReaction={item.viewer_reaction}
      />
      <CommentThread
        activityId={item.id}
        initialCount={item.comment_count}
        initialViewerHasCommented={item.viewer_has_commented}
      />
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
      <div className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
        <p>
          No updates yet. Share an update above, or follow people and organizations to fill your
          feed with their news.
        </p>
        <Link
          href="/discovery"
          className="rounded-xl border border-beedero-border px-4 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow"
        >
          Discover people and organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const showSuggestedHeader =
          item.is_suggested && (index === 0 || !items[index - 1]?.is_suggested);
        return (
          <div key={`${item.type}-${item.id}`}>
            {showSuggestedHeader && (
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                Suggested for you
              </p>
            )}
            <FeedCard item={item} />
          </div>
        );
      })}
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
