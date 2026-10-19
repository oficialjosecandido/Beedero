"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { Building2, Repeat2 } from "lucide-react";
import { toast } from "sonner";

import { EventParticipationBar } from "@/components/EventParticipationBar";
import { LinkPreviewCard } from "@/components/LinkPreviewCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RichText } from "@/components/RichText";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/types";

import { loadMoreFeedAction } from "./actions";
import { CommentThread } from "./CommentThread";
import { ReactionBar } from "./ReactionBar";
import { feedPostShareUrl, shareFeedPost } from "./share-post";
import type { FeedItem } from "./types";

const BODY_TRUNCATE_THRESHOLD = 220;

function compactTime(iso?: string) {
  if (!iso) return null;
  return formatRelativeTime(iso).replace(" ago", "");
}

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function FeedCard({ item }: { item: FeedItem }) {
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isLongBody = (item.value.body?.length ?? 0) > BODY_TRUNCATE_THRESHOLD;
  const isOrg = item.type === "org";

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareFeedPost(item);
      if (result === "copied") toast.success("Post link copied");
      else if (result === "shared") toast.success("Shared");
    } catch {
      toast.error("Could not share this post.");
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(feedPostShareUrl(item.id));
      toast.success("Post link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
    setMenuOpen(false);
  }

  const dateLabel =
    item.kind === "events" && item.value.occurred_at && item.value.ends_at
      ? `${formatDateTime(item.value.occurred_at)} – ${formatDateTime(item.value.ends_at)}`
      : item.value.occurred_at
        ? formatDate(item.value.occurred_at)
        : null;

  const name = isOrg && item.org ? item.org.name : item.author?.name ?? "Someone";
  const pictureUrl = isOrg && item.org ? item.org.logo : item.author?.profile_picture;
  const subtitle = isOrg
    ? SECTION_LABELS[item.kind] ?? item.kind
    : item.author?.headline || (SECTION_LABELS[item.kind] ?? item.kind);
  const timeLabel = compactTime(item.created_at) || dateLabel;
  const profileHref =
    isOrg && item.org ? `/org/${item.org.slug}` : item.author?.handle ? `/p/${item.author.handle}` : null;

  const avatar = pictureUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      src={pictureUrl}
      alt=""
      className={`size-10 shrink-0 object-cover ${isOrg ? "rounded-sm" : "rounded-full"}`}
    />
  ) : (
    <span
      className={`grid size-10 shrink-0 place-items-center text-xs font-black ${
        isOrg ? "rounded-sm bg-beedero-yellow text-beedero-black" : "rounded-full bg-[#5f6b80] text-white"
      }`}
    >
      {initialsFrom(name) || name.charAt(0).toUpperCase()}
    </span>
  );

  const headerInner = (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-bold text-white">{name}</span>
          {isOrg && (
            <span className="grid size-4 place-items-center bg-beedero-yellow text-[8px] font-black text-beedero-black [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]">
              ✓
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-white/40">
          {[subtitle, timeLabel].filter(Boolean).join(" · ")}
        </p>
      </div>
    </>
  );

  return (
    <article
      id={`post-${item.id}`}
      className={
        isOrg
          ? "border border-beedero-yellow/20 bg-beedero-yellow/[0.03]"
          : "border border-white/10 bg-white/[0.025]"
      }
    >
      {isOrg && (
        <div className="flex items-center gap-2 border-b border-beedero-yellow/15 bg-beedero-yellow/[0.04] px-5 py-2.5">
          <Building2 size={12} className="text-beedero-yellow" aria-hidden />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-beedero-yellow/70">
            Organisation · {SECTION_LABELS[item.kind] ?? item.kind}
          </span>
        </div>
      )}

      <div className="p-5">
        <header className="flex items-start gap-3">
          {profileHref ? (
            <Link href={profileHref} className="flex min-w-0 flex-1 items-start gap-3 hover:opacity-90">
              {headerInner}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-start gap-3">{headerInner}</div>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="grid size-8 place-items-center text-white/35 transition hover:text-white"
              aria-label="Post options"
            >
              <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden>
                <circle cx="2" cy="2" r="2" />
                <circle cx="8" cy="2" r="2" />
                <circle cx="14" cy="2" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 border border-white/15 bg-app-elevated py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="block w-full px-4 py-2.5 text-left text-xs text-white/70 hover:bg-white/5"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2.5 text-left text-xs text-red-400 hover:bg-white/5"
                >
                  Report post
                </button>
              </div>
            )}
          </div>
        </header>

        {item.value.title && item.value.title !== "Update" && (
          <h2 className="mt-4 text-lg font-bold leading-7 text-white">{item.value.title}</h2>
        )}
        {item.value.body && (
          <>
            <p
              className={`mt-3 text-base leading-7 text-white/85 ${
                !bodyExpanded && isLongBody ? "line-clamp-4" : ""
              }`}
            >
              <RichText body={item.value.body} mentions={item.value.mentions} />
            </p>
            {isLongBody && (
              <button
                type="button"
                onClick={() => setBodyExpanded((v) => !v)}
                className="mt-1 text-sm font-semibold text-white/45 hover:text-beedero-yellow"
              >
                {bodyExpanded ? "See less" : "…see more"}
              </button>
            )}
            <div className="mt-2 [&_a]:text-beedero-yellow">
              <LinkPreviewCard body={item.value.body} tone="dark" />
            </div>
          </>
        )}

        {item.value.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={item.value.image} alt="" className="mt-4 max-h-72 w-full object-cover" />
        )}

        {(item.kind === "milestones" || item.kind === "milestone") &&
          typeof item.value.payload?.category === "string" && (
            <span className="mt-4 inline-flex border border-beedero-yellow/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-beedero-yellow">
              + {item.value.payload.category}
            </span>
          )}

        {item.kind === "events" && item.value.payload && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
            {typeof item.value.payload.format === "string" && (
              <span className="bg-white/10 px-2.5 py-1 font-semibold uppercase">
                {item.value.payload.format.replace("_", " ")}
              </span>
            )}
            {typeof item.value.payload.location === "string" && item.value.payload.location && (
              <span>{item.value.payload.location}</span>
            )}
          </div>
        )}

        {item.kind === "events" && (
          <div className="mt-3 text-white/70">
            <EventParticipationBar
              activityId={item.id}
              initialParticipating={item.viewer_participation === "going"}
            />
          </div>
        )}

        <div
          className={`mt-4 flex flex-wrap items-center gap-3 border-t pt-4 ${
            isOrg ? "border-beedero-yellow/15" : "border-white/10"
          }`}
        >
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
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing}
            className="flex items-center gap-1 text-sm font-bold text-white/45 transition hover:text-white disabled:opacity-50"
          >
            <Repeat2 size={15} aria-hidden />
            {sharing ? "…" : "Share"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function FeedList({
  items,
  setItems,
  cursor,
  setCursor,
}: {
  items: FeedItem[];
  setItems: Dispatch<SetStateAction<FeedItem[]>>;
  cursor: string | null;
  setCursor: Dispatch<SetStateAction<string | null>>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    const node = document.getElementById(`post-${postId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("ring-1", "ring-beedero-yellow/60");
    const timer = window.setTimeout(() => {
      node.classList.remove("ring-1", "ring-beedero-yellow/60");
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [items]);

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
      <div className="flex flex-col items-start gap-3 border border-dashed border-white/15 bg-white/[0.02] p-8 text-sm text-white/45">
        <p>
          No updates yet. Share an update above, or follow people and organizations to fill your feed.
        </p>
        <Link
          href="/discovery"
          className="border border-beedero-yellow px-4 py-2 text-sm font-semibold text-beedero-yellow hover:bg-beedero-yellow/10"
        >
          Discover people and organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item, index) => {
        const showSuggestedHeader =
          item.is_suggested && (index === 0 || !items[index - 1]?.is_suggested);
        return (
          <div key={`${item.type}-${item.id}`}>
            {showSuggestedHeader && (
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
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
          className="mx-auto flex items-center gap-2 border border-white/15 bg-white/5 px-6 py-2 text-sm font-semibold text-white/70 hover:border-beedero-yellow/40 disabled:opacity-50"
        >
          {isPending && <LoadingSpinner className="size-4" label="" />}
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
