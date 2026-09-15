"use client";

import { useState, useTransition } from "react";

import { recordInterestAction } from "@/app/(app)/cofounder/actions";
import { BuilderCardView } from "@/components/cofounder/BuilderCardView";
import { MatchCelebration } from "@/components/cofounder/MatchCelebration";
import { SafetyMenu } from "@/components/cofounder/SafetyMenu";
import { EmptyState } from "@/components/EmptyState";
import type { BuilderCard, CofounderMatch } from "@/lib/cofounder-options";

/** One card at a time, with two named buttons. No swipe, no drag, no
 * counter ticking down, no undo-by-shaking (doc §5) — the point is that
 * deciding to build a company with someone deserves a moment's thought. */
export function Deck({
  cards,
  dailyLimit,
  active,
  onOpenCard,
  onMatched,
}: {
  cards: BuilderCard[];
  dailyLimit: number;
  active: boolean;
  onOpenCard: () => void;
  onMatched: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [match, setMatch] = useState<CofounderMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!active) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-center">
        <p className="text-sm font-semibold text-zinc-900">You haven&apos;t opted in yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Nobody sees you here until you turn this on, and you can turn it off at any time. Your
          builder card is separate from your public profile.
        </p>
        <button
          type="button"
          onClick={onOpenCard}
          className="mt-4 inline-flex rounded-full bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
        >
          Set up your builder card
        </button>
      </div>
    );
  }

  const current = cards[index];

  function decide(liked: boolean) {
    if (!current || pending) return;
    startTransition(async () => {
      setError(null);
      const result = await recordInterestAction(current.id, liked);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.matched && result.match) setMatch(result.match);
      setIndex((value) => value + 1);
    });
  }

  if (!current) {
    return (
      <>
        {match && (
          <MatchCelebration
            match={match}
            onClose={() => setMatch(null)}
            onSeeMatches={() => {
              setMatch(null);
              onMatched();
            }}
          />
        )}
        {cards.length === 0 ? (
          <EmptyState
            title="No builders for you today"
            description="The deck is drawn from people whose strengths fit yours and who are looking for what you bring. Widen what you're looking for, or come back tomorrow."
            action={{ href: "/cofounder?tab=card", label: "Edit your card" }}
          />
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              That&apos;s everyone for today
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              You went through all {cards.length} of today&apos;s builders. A new set is drawn
              tomorrow — {dailyLimit} at most, chosen rather than endless.
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {match && (
        <MatchCelebration
          match={match}
          onClose={() => setMatch(null)}
          onSeeMatches={() => {
            setMatch(null);
            onMatched();
          }}
        />
      )}

      <p className="text-xs font-medium text-zinc-500">
        {index + 1} of {cards.length} today
      </p>

      <BuilderCardView card={current} />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(true)}
          className="flex-1 rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Interested"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(false)}
          className="flex-1 rounded-xl border-2 border-beedero-border px-5 py-3 text-sm font-semibold text-beedero-black transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          Pass
        </button>
      </div>
      <p className="text-xs leading-5 text-zinc-500">
        They&apos;re only told if you both say yes. A pass is private, and nothing is sent either
        way until there&apos;s a match.
      </p>

      <SafetyMenu
        key={current.id}
        userId={current.id}
        name={current.name}
        onBlocked={() => setIndex((value) => value + 1)}
      />
    </div>
  );
}
