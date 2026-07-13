"use client";

import { useActionState, useState, useTransition } from "react";

import { useActionToast } from "@/lib/use-action-toast";

import { deleteCommentAction, loadCommentsAction, postCommentAction } from "./actions";
import type { Comment } from "./types";

export function CommentThread({
  activityId,
  initialCount,
}: {
  activityId: number;
  initialCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [count, setCount] = useState(initialCount);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [isPending, startTransition] = useTransition();

  function expand() {
    setExpanded(true);
    if (loaded) return;
    startTransition(async () => {
      try {
        const res = await loadCommentsAction(activityId);
        setComments(res.items);
        setCursor(res.next_cursor);
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

  function handleDelete(commentId: number) {
    startTransition(async () => {
      try {
        await deleteCommentAction(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCount((c) => Math.max(0, c - 1));
      } catch {
        // no-op
      }
    });
  }

  async function commentFormAction(_prevState: string | null, formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return "Write something first.";
    try {
      const comment = await postCommentAction(activityId, body, replyTo?.id);
      setComments((prev) => [comment, ...prev]);
      setCount((c) => c + 1);
      setReplyTo(null);
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
        className="mt-3 text-xs font-medium text-zinc-500 hover:underline"
      >
        {count > 0 ? `View ${count} comment${count === 1 ? "" : "s"}` : "Add a comment"}
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-beedero-black/10 pt-3">
      {comments.length > 0 && (
        <ul className="grid gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl bg-zinc-50 p-2.5 text-sm ${c.parent_id ? "ml-6" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-900">{c.author_name}</span>
                <div className="flex items-center gap-2">
                  {!c.parent_id && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(c)}
                      className="text-xs text-zinc-400 hover:underline"
                    >
                      Reply
                    </button>
                  )}
                  {c.can_delete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-zinc-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="mt-2 text-xs font-medium text-zinc-500 hover:underline disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more comments"}
        </button>
      )}
      <form action={formAction} className="mt-3 flex items-start gap-2">
        <div className="flex-1">
          {replyTo && (
            <p className="mb-1 text-xs text-zinc-400">
              Replying to {replyTo.author_name}{" "}
              <button type="button" onClick={() => setReplyTo(null)} className="underline">
                cancel
              </button>
            </p>
          )}
          <textarea
            name="body"
            rows={2}
            maxLength={2000}
            placeholder="Write a comment…"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-beedero-yellow px-4 py-2 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </div>
  );
}
