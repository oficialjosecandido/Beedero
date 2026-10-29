"use client";

import { useEffect } from "react";

/**
 * Keeps the sliding refresh cookie alive across days.
 *
 * The access cookie lasts ~55 minutes; overnight opens rely on trading the
 * 90-day refresh cookie. proxy.ts does that on navigation into guarded routes,
 * and this covers the case where the PWA is already open / resumed from the
 * home screen without a full document navigation through the proxy.
 *
 * Periodic calls use `?force=1` so the refresh cookie keeps sliding even when
 * the access token is still young. Mount / focus / visibility only hit Firebase
 * when access is near expiry (see /api/auth/refresh).
 */
export function SessionRefresh() {
  useEffect(() => {
    let cancelled = false;
    let lastSoftRefreshAt = 0;

    async function refresh(force = false) {
      try {
        const qs = force ? "?force=1" : "";
        await fetch(`/api/auth/refresh${qs}`, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // Network blip — leave cookies alone; the next attempt or proxy will retry.
      }
    }

    function softRefresh() {
      if (cancelled || document.visibilityState !== "visible") return;
      // Tab switches used to stack Firebase round-trips; one soft check per
      // minute is enough because the route no-ops when access is still fresh.
      const now = Date.now();
      if (now - lastSoftRefreshAt < 60_000) return;
      lastSoftRefreshAt = now;
      void refresh(false);
    }

    // Immediate pass for cold PWA launches where access already expired.
    softRefresh();
    document.addEventListener("visibilitychange", softRefresh);
    window.addEventListener("focus", softRefresh);

    // Sliding renewal while the app stays open across a long session.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 1000 * 60 * 45);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", softRefresh);
      window.removeEventListener("focus", softRefresh);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
