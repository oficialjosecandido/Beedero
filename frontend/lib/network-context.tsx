"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type NetworkCounts = { connections: number; pending: number; following: number };

const EMPTY_COUNTS: NetworkCounts = { connections: 0, pending: 0, following: 0 };

type NetworkContextValue = {
  counts: NetworkCounts;
  refresh: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<NetworkCounts>(EMPTY_COUNTS);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/network/counts", { cache: "no-store" });
      if (!res.ok) return;
      setCounts((await res.json()) as NetworkCounts);
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/network/counts", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        setCounts((await res.json()) as NetworkCounts);
      } catch {
        // ignore polling errors
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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
