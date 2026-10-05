"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";

import { MentionTextarea } from "@/components/MentionTextarea";
import { RichText } from "@/components/RichText";
import { formatRelativeTime } from "@/lib/format";
import { useActionToast } from "@/lib/use-action-toast";

import { loadCommentsAction, postCommentAction } from "./actions";
import type { Comment } from "./types";

function CommentAvatar({ name, pictureUrl }: { name: string; pictureUrl?: string | null }) {
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img loading="lazy" src={pictureUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#4a5568] text-[10px] font-black">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CommentAuthor({ comment }: { comment: Comment }) {
  const avatar = <CommentAvatar name={comment.author_name} pictureUrl={comment.author_profile_picture} />;
  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <b className="text-sm text-white">{comment.author_name}</b>
        <small className="text-xs text-white/30">
          {formatRelativeTime(comment.created_at).replace(" ago", "")}
        </small>
      </div>
      <p className="mt-1 text-base leading-7 text-white/70">
        <RichText body={comment.body} mentions={comment.mentions} />
      </p>
    </div>
  );

  if (comment.author_handle) {
    return (
      <Link href={`/p/${comment.author_handle}`} className="flex min-w-0 flex-1 gap-3 hover:opacity-90">
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
        // leave composer usable
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
        // no-op
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

  return (
    <>
      <button
        type="button"
        onClick={() => (expanded ? setExpanded(false) : expand())}
        className={`flex items-center gap-1 text-sm font-bold transition ${
          expanded ? "text-beedero-yellow" : "text-white/45 hover:text-white"
        }`}
      >
        <MessageSquare size={15} strokeWidth={2} aria-hidden />
        Comment
        {count > 0 && <span className="ml-0.5 opacity-50">{count}</span>}
      </button>

      {expanded && (
        <div className="-mx-5 mt-4 basis-full border-t border-white/10 bg-white/[0.015]">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 border-b border-white/[0.06] px-5 py-4">
              <CommentAuthor comment={comment} />
            </div>
          ))}
          {cursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isPending}
              className="px-5 py-2 text-sm font-semibold text-white/45 hover:text-white disabled:opacity-50"
            >
              {isPending ? "Loading…" : "Load more comments"}
            </button>
          )}
          {viewerHasCommented ? (
            <p className="px-5 py-3 text-base text-white/40">You have already commented on this post.</p>
          ) : (
            <form action={formAction} className="flex gap-3 px-5 py-3">
              <div className="flex flex-1 items-center gap-2 border border-white/10 bg-white/5 px-3">
                <MentionTextarea
                  name="body"
                  rows={1}
                  maxLength={2000}
                  placeholder="Add a comment…"
                  className="min-h-0 flex-1 resize-none border-0 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/30"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="text-beedero-yellow disabled:opacity-30"
                  aria-label="Post comment"
                >
                  <Send size={13} aria-hidden />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
