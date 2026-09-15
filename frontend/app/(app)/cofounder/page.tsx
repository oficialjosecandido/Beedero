import { AppShellLayout } from "@/components/AppShellLayout";
import { CofounderTabs } from "@/components/cofounder/CofounderTabs";
import { apiFetch, safeFetch } from "@/lib/api";
import type {
  BuilderCard,
  BuilderProfile,
  CofounderMatch,
  CofounderStatus,
} from "@/lib/cofounder-options";

export const metadata = { title: "Find a co-founder" };

type Tab = "deck" | "matches" | "card";

function parseTab(value: string | undefined): Tab {
  return value === "matches" || value === "card" ? value : "deck";
}

export default async function CofounderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  // Its own destination, deliberately not folded into Discover (doc §9):
  // looking for a co-founder is a different intent from browsing the network.
  const [profile, deck, matches, status] = await Promise.all([
    safeFetch(apiFetch<BuilderProfile>("/cofounder/profile/"), null),
    safeFetch(
      apiFetch<{ active: boolean; daily_limit: number; cards: BuilderCard[] }>("/cofounder/deck/"),
      { active: false, daily_limit: 10, cards: [] }
    ),
    safeFetch(apiFetch<{ results: CofounderMatch[] }>("/cofounder/matches/"), { results: [] }),
    safeFetch(apiFetch<CofounderStatus>("/cofounder/status/"), null),
  ]);

  const initialTab: Tab = profile?.is_active ? parseTab(params.tab) : "card";

  return (
    <AppShellLayout label="Find a co-founder">
      <div className="flex flex-col gap-5">
        <header className="rounded-3xl border-2 border-beedero-border bg-beedero-yellow px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-beedero-black/70">
            Find a co-founder
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            Ten builders a day. No swiping.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-beedero-black/80">
            A small, considered set of people whose strengths fit yours — ranked by what they&apos;ve
            actually verified, not by a photo. You both have to say yes before anyone can write.
          </p>
        </header>

        <CofounderTabs
          initialTab={initialTab}
          profile={profile}
          deck={deck.cards}
          dailyLimit={deck.daily_limit}
          deckActive={deck.active}
          matches={matches.results}
          status={status}
        />
      </div>
    </AppShellLayout>
  );
}
