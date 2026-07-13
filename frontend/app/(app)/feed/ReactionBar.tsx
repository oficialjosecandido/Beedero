"use client";

import { useState, useTransition } from "react";

import { reactAction, unreactAction } from "./actions";

const REACTIONS: { kind: string; emoji: string; label: string }[] = [
  { kind: "like", emoji: "👍", label: "Like" },
  { kind: "insight", emoji: "💡", label: "Insight" },
  { kind: "congrats", emoji: "🎉", label: "Congrats" },
];

export function ReactionBar({
  activityId,
  initialCount,
  initialReaction,
}: {
  activityId: number;
  initialCount: number;
  initialReaction: string | null;
}) {
  const [count, setCount] = useState(initialCount);
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [isPending, startTransition] = useTransition();

  function toggle(kind: string) {
    startTransition(async () => {
      try {
        if (reaction === kind) {
          const res = await unreactAction(activityId);
          setReaction(null);
          setCount(res.reaction_count);
        } else {
          const res = await reactAction(activityId, kind);
          setReaction(kind);
          setCount(res.reaction_count);
        }
      } catch {
        // fire-and-forget: local state simply doesn't change on failure
      }
    });
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      {REACTIONS.map(({ kind, emoji, label }) => (
        <button
          key={kind}
          type="button"
          title={label}
          disabled={isPending}
          onClick={() => toggle(kind)}
          className={`rounded-full px-2.5 py-0.5 text-sm font-bold transition-colors disabled:opacity-50 ${
            reaction === kind
              ? "bg-beedero-yellow text-beedero-black"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {emoji}
        </button>
      ))}
      {count > 0 && <span className="text-xs text-zinc-400">{count}</span>}
    </div>
  );
}
