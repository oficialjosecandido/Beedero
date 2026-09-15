"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setMatchOutcomeAction } from "@/app/(app)/cofounder/actions";
import { BuilderCardView } from "@/components/cofounder/BuilderCardView";
import { CreateOrgFromMatch } from "@/components/cofounder/CreateOrgFromMatch";
import { SafetyMenu } from "@/components/cofounder/SafetyMenu";
import { EmptyState } from "@/components/EmptyState";
import type { CofounderMatch } from "@/lib/cofounder-options";
import { useMessaging } from "@/lib/messaging-context";

// "matched" and "formed_org" are absent on purpose: matched is the starting
// state (nothing to set), and formed_org is only ever written by actually
// creating the organization — see cofounder.services.set_outcome.
const OUTCOME_ACTIONS = [
  { value: "chatting", label: "We're talking" },
  { value: "met", label: "We met in person" },
  { value: "archived", label: "Not a fit" },
] as const;

function MatchRow({ match }: { match: CofounderMatch }) {
  const { openChatWindow } = useMessaging();
  const [expanded, setExpanded] = useState(false);
  const [outcome, setOutcome] = useState(match.outcome);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const archived = outcome === "archived";

  function record(value: string) {
    startTransition(async () => {
      setError(null);
      const result = await setMatchOutcomeAction(match.id, value);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOutcome(value);
    });
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {match.other.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              loading="lazy"
              src={match.other.profile_picture}
              alt=""
              className="size-11 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
              {match.other.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-zinc-950">{match.other.name}</p>
              {match.other.is_verified && (
                <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-[10px] font-bold text-beedero-black">
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {match.outcome_label} · matched {new Date(match.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {match.conversation_id !== null && (
            <button
              type="button"
              onClick={() =>
                openChatWindow(match.conversation_id!, {
                  id: match.other.id,
                  name: match.other.name,
                  profile_picture: match.other.profile_picture,
                })
              }
              className="rounded-xl bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
            >
              Message
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-xl border border-beedero-border px-3 py-1.5 text-sm font-medium text-beedero-black hover:bg-zinc-50"
          >
            {expanded ? "Hide card" : "View card"}
          </button>
        </div>
      </div>

      {expanded && <BuilderCardView card={match.other} />}

      {match.org ? (
        <div className="rounded-2xl border border-beedero-border bg-zinc-50/70 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">
            You started{" "}
            <Link href={`/org/${match.org.slug}`} className="underline hover:text-beedero-black">
              {match.org.name}
            </Link>{" "}
            together
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {match.other.name} joins as an owner once they accept the invite.
          </p>
        </div>
      ) : (
        !archived && <CreateOrgFromMatch match={match} />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-beedero-border pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Where did it go?
        </span>
        {OUTCOME_ACTIONS.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={pending || outcome === action.value}
            onClick={() => record(action.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
              outcome === action.value
                ? "border-beedero-black bg-beedero-black text-beedero-white"
                : "border-beedero-border text-beedero-black/70 hover:bg-zinc-50"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      <SafetyMenu userId={match.other.id} name={match.other.name} />
    </li>
  );
}

export function MatchesList({ matches }: { matches: CofounderMatch[] }) {
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No matches yet"
        description="A match happens when you and another builder both say you're interested. Nobody is told about a one-sided yes."
        action={{ href: "/cofounder?tab=deck", label: "See today's builders" }}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {matches.map((match) => (
        <MatchRow key={match.id} match={match} />
      ))}
    </ul>
  );
}
