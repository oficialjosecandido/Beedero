"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FaThumbsDown, FaThumbsUp } from "react-icons/fa";

import { reactAction, unreactAction } from "./actions";

type ReactionCounts = Record<string, number>;

function normalizeCounts(counts?: ReactionCounts): ReactionCounts {
  return {
    like: counts?.like ?? 0,
    insight: counts?.insight ?? 0,
    congrats: counts?.congrats ?? 0,
  };
}

export function ReactionBar({
  activityId,
  initialCounts,
  initialReaction,
}: {
  activityId: number;
  /** Kept for call-site compatibility; counts come from `initialCounts`. */
  initialCount?: number;
  initialCounts?: ReactionCounts;
  initialReaction: string | null;
}) {
  const [counts, setCounts] = useState<ReactionCounts>(normalizeCounts(initialCounts));
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [isPending, startTransition] = useTransition();

  function applyResponse(data: { reaction_count: number; reaction_counts: ReactionCounts }) {
    setCounts(normalizeCounts(data.reaction_counts));
  }

  function toggle(kind: string) {
    startTransition(async () => {
      const result =
        reaction === kind ? await unreactAction(activityId) : await reactAction(activityId, kind);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setReaction(reaction === kind ? null : kind);
      applyResponse(result);
    });
  }

  const actions = [
    { kind: "like", label: "Relevant", Icon: FaThumbsUp },
    { kind: "insight", label: "Not for me", Icon: FaThumbsDown },
  ] as const;

  return (
    <div className="flex flex-1 flex-wrap gap-3 text-xs font-bold text-white/45">
      {actions.map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          disabled={isPending}
          onClick={() => toggle(kind)}
          className={`flex items-center gap-1 transition disabled:opacity-50 ${
            reaction === kind ? "text-beedero-yellow" : "hover:text-white"
          }`}
        >
          <Icon className="size-[13px]" aria-hidden />
          {label}
          {(counts[kind] ?? 0) > 0 && (
            <span className="ml-0.5 opacity-50">{counts[kind]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
