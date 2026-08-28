"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FaGlassCheers, FaLightbulb, FaThumbsUp } from "react-icons/fa";
import type { IconType } from "react-icons";

import { reactAction, unreactAction } from "./actions";

const REACTIONS: { kind: string; icon: IconType; label: string }[] = [
  { kind: "like", icon: FaThumbsUp, label: "Like" },
  { kind: "insight", icon: FaLightbulb, label: "Insight" },
  { kind: "congrats", icon: FaGlassCheers, label: "Congrats" },
];

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
  initialCount,
  initialCounts,
  initialReaction,
}: {
  activityId: number;
  initialCount: number;
  initialCounts?: ReactionCounts;
  initialReaction: string | null;
}) {
  const [count, setCount] = useState(initialCount);
  const [counts, setCounts] = useState<ReactionCounts>(normalizeCounts(initialCounts));
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [isPending, startTransition] = useTransition();

  function applyResponse(data: { reaction_count: number; reaction_counts: ReactionCounts }) {
    setCount(data.reaction_count);
    setCounts(normalizeCounts(data.reaction_counts));
  }

  function toggle(kind: string) {
    startTransition(async () => {
      const result =
        reaction === kind
          ? await unreactAction(activityId)
          : await reactAction(activityId, kind);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (reaction === kind) {
        setReaction(null);
      } else {
        setReaction(kind);
      }
      applyResponse(result);
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {REACTIONS.map(({ kind, icon: Icon, label }) => {
        const kindCount = counts[kind] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            title={label}
            disabled={isPending}
            onClick={() => toggle(kind)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold transition-colors disabled:opacity-50 ${
              reaction === kind
                ? "bg-beedero-yellow text-beedero-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Icon className="text-sm" aria-hidden />
            <span className="min-w-[1ch] text-xs tabular-nums">{kindCount}</span>
          </button>
        );
      })}
      {count > 0 && (
        <span className="text-xs text-subtle">
          {count} reaction{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
