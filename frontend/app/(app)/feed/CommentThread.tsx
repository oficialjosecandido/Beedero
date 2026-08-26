"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FaRegComment } from "react-icons/fa";

import { formatDate } from "@/lib/format";
import { useActionToast } from "@/lib/use-action-toast";
import { MentionTextarea } from "@/components/MentionTextarea";
import { RichText } from "@/components/RichText";

import { loadCommentsAction, postCommentAction } from "./actions";
import type { Comment } from "./types";

function CommentAvatar({ name, pictureUrl }: { name: string; pictureUrl?: string | null }) {
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pictureUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/40 text-xs font-bold text-beedero-black">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CommentAuthor({ comment }: { comment: Comment }) {
  const avatar = <CommentAvatar name={comment.author_name} pictureUrl={comment.author_profile_picture} />;
  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold text-beedero-black">{comment.author_name}</span>
        <span className="text-xs text-zinc-400">{formatDate(comment.created_at)}</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-zinc-700">
        <RichText body={comment.body} mentions={comment.mentions} />
      </p>
    </div>
  );

  if (comment.author_handle) {
    return (
      <Link
        href={`/p/${comment.author_handle}`}
        className="flex min-w-0 flex-1 gap-3 hover:opacity-90"
      >
        {avatar}
        {content}
      </Link>
    );
  }

  return (
    <>
      {avatar}
      {content}
    </>
  );
}

export function CommentThread({
  activityId,
  initialCount,
  initialViewerHasCommented = false,
}: {
  activityId: number;
  initialCount: number;
  initialViewerHasCommented?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [count, setCount] = useState(initialCount);
  const [viewerHasCommented, setViewerHasCommented] = useState(initialViewerHasCommented);
  const [isPending, startTransition] = useTransition();

  function expand() {
    setExpanded(true);
    if (loaded) return;
    startTransition(async () => {
      try {
        const res = await loadCommentsAction(activityId);
        setComments(res.items);
        setCursor(res.next_cursor);
        setViewerHasCommented(res.viewer_has_commented);
        setLoaded(true);
      } catch {
        // leave the composer usable even if the initial list fails to load
      }
    });
  }

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      try {
        const res = await loadCommentsAction(activityId, cursor);
        setComments((prev) => [...prev, ...res.items]);
        setCursor(res.next_cursor);
      } catch {
        // no-op: user can retry via the same button
      }
    });
  }

  async function commentFormAction(_prevState: string | null, formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return "Write something first.";
    try {
      const comment = await postCommentAction(activityId, body);
      setComments((prev) => [comment, ...prev]);
      setCount((c) => c + 1);
      setViewerHasCommented(true);
      return null;
    } catch {
      return "Could not post your comment.";
    }
  }
  const [state, formAction, pending] = useActionState(commentFormAction, null);
  useActionToast(state, pending);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-beedero-black hover:underline"
      >
        <FaRegComment className="text-sm" aria-hidden />
        {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add a comment"}
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-beedero-border pt-4">
      {comments.length > 0 && (
        <ul className="grid gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex gap-3 rounded-2xl border border-beedero-border/60 bg-zinc-50/80 p-3"
            >
              <CommentAuthor comment={comment} />
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mt-3 text-xs font-semibold text-zinc-500 hover:text-beedero-black hover:underline disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more comments"}
        </button>
      )}
      {viewerHasCommented ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          You have already commented on this post. Each person can leave one comment.
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex items-end gap-2">
          <MentionTextarea
            name="body"
            rows={2}
            maxLength={2000}
            placeholder="Write a comment…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-beedero-border bg-beedero-white px-3 py-2.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full bg-beedero-yellow px-4 py-2.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post"}
          </button>
        </form>
      )}
    </div>
  );
}
