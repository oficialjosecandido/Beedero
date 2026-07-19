"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setEventParticipationAction } from "@/app/(app)/feed/actions";

export function EventParticipationBar({
  activityId,
  initialParticipating,
}: {
  activityId: number;
  initialParticipating: boolean;
}) {
  const router = useRouter();
  const [participating, setParticipating] = useState(initialParticipating);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleParticipation(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setEventParticipationAction(activityId, next);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setParticipating(next);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-beedero-border pt-4">
      {participating ? (
        <>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            You&apos;re participating
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => toggleParticipation(false)}
            className="rounded-full border border-beedero-border px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-beedero-black hover:text-beedero-black disabled:opacity-50"
          >
            {isPending ? "Updating…" : "Cancel participation"}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => toggleParticipation(true)}
          className="rounded-full bg-beedero-black px-4 py-1.5 text-xs font-bold text-beedero-yellow hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Accept & participate"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
