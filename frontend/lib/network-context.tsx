"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { type BadgeCounts, useBadgeCounts } from "@/lib/badge-counts";

export type NetworkCounts = { connections: number; pending: number; following: number };

const EMPTY_COUNTS: NetworkCounts = { connections: 0, pending: 0, following: 0 };

function sameCounts(a: NetworkCounts, b: NetworkCounts) {
  return (
    a.connections === b.connections && a.pending === b.pending && a.following === b.following
  );
}

type NetworkContextValue = {
  counts: NetworkCounts;
  refresh: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<NetworkCounts>(EMPTY_COUNTS);

  // The counters are usually identical from one poll to the next; keeping the
  // previous object spares every consumer of `counts` a re-render per tick.
  const apply = useCallback((next: NetworkCounts) => {
    setCounts((prev) => (sameCounts(prev, next) ? prev : next));
  }, []);

  // Targeted refresh after a mutation (accepting a request, following an
  // org); the steady-state counters come from the chrome's shared poll.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/network/counts", { cache: "no-store" });
      if (!res.ok) return;
      apply((await res.json()) as NetworkCounts);
    } catch {
      // ignore polling errors
    }
  }, [apply]);

  const applyBadges = useCallback((badges: BadgeCounts) => apply(badges.network), [apply]);

  useBadgeCounts(applyBadges);

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  return context;
}
