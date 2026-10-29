"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function SitePageViewBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    // The Nexus is staff using an internal tool, not traffic to the site.
    if (!pathname || pathname.startsWith("/api") || pathname.startsWith("/beedero-nexus")) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({ path: pathname });
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/pageview", blob);
      return;
    }

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
