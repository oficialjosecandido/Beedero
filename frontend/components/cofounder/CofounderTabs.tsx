"use client";

import { useState } from "react";

import { BuilderProfileForm } from "@/components/cofounder/BuilderProfileForm";
import { Deck } from "@/components/cofounder/Deck";
import { MatchesList } from "@/components/cofounder/MatchesList";
import type {
  BuilderCard,
  BuilderProfile,
  CofounderMatch,
  CofounderStatus,
} from "@/lib/cofounder-options";

type Tab = "deck" | "matches" | "card";

const TABS: { key: Tab; label: string }[] = [
  { key: "deck", label: "Today" },
  { key: "matches", label: "Matches" },
  { key: "card", label: "Your card" },
];

export function CofounderTabs({
  initialTab,
  profile,
  deck,
  dailyLimit,
  deckActive,
  matches,
  status,
}: {
  initialTab: Tab;
  profile: BuilderProfile | null;
  deck: BuilderCard[];
  dailyLimit: number;
  deckActive: boolean;
  matches: CofounderMatch[];
  status: CofounderStatus | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(key: Tab) {
    setTab(key);
    window.history.replaceState(null, "", `/cofounder?tab=${key}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t.key
                ? "bg-beedero-black text-beedero-white"
                : "border border-beedero-border text-beedero-black/70 hover:bg-zinc-50"
            }`}
          >
            {t.label}
            {t.key === "matches" && matches.length > 0 && ` (${matches.length})`}
          </button>
        ))}
      </nav>

      {tab === "deck" && (
        <Deck
          cards={deck}
          dailyLimit={dailyLimit}
          active={deckActive}
          onOpenCard={() => selectTab("card")}
          onMatched={() => selectTab("matches")}
        />
      )}
      {tab === "matches" && <MatchesList matches={matches} />}
      {tab === "card" && <BuilderProfileForm profile={profile} status={status} />}
    </div>
  );
}
