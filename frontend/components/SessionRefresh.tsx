"use client";

import { useEffect } from "react";

/**
 * Keeps the sliding refresh cookie alive across days.
 *
 * The access cookie lasts ~55 minutes; overnight opens rely on trading the
 * 90-day refresh cookie. proxy.ts does that on navigation into guarded routes,
 * and this covers the case where the PWA is already open / resumed from the
 * home screen without a full document navigation through the proxy.
 */
export function SessionRefresh() {
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // Network blip — leave cookies alone; the next attempt or proxy will retry.
      }
    }

    function onVisible() {
      if (cancelled || document.visibilityState !== "visible") return;
      void refresh();
    }

    // Immediate pass for cold PWA launches where access already expired.
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Sliding renewal while the app stays open across a long session.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 1000 * 60 * 45);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
