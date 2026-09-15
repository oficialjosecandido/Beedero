"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { CofounderMatch } from "@/lib/cofounder-options";

/** Doc §9: celebrate the match, but moderately — no confetti cannon, no
 * sound. Two people agreeing to talk is worth marking; it isn't a jackpot. */
export function MatchCelebration({
  match,
  onClose,
  onSeeMatches,
}: {
  match: CofounderMatch;
  onClose: () => void;
  onSeeMatches: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-beedero-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="It's a match"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-xl outline-none"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-beedero-black/60">
          Mutual interest
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950">
          You and {match.other.name} both said yes
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Your conversation is open. Most co-founder pairs that work out met in person early — so
          say hello, then find a time.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {match.conversation_id !== null && (
            <Link
              href={`/messages?chat=${match.conversation_id}`}
              className="flex-1 rounded-xl bg-beedero-yellow px-4 py-2.5 text-center text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
            >
              Say hello
            </Link>
          )}
          <button
            type="button"
            onClick={onSeeMatches}
            className="flex-1 rounded-xl border-2 border-beedero-border px-4 py-2.5 text-sm font-semibold text-beedero-black hover:bg-zinc-50"
          >
            See your matches
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-xs font-medium text-zinc-500 hover:text-beedero-black"
        >
          Keep going through today&apos;s builders
        </button>
      </div>
    </div>
  );
}
