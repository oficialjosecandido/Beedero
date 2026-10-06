"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";

const MOBILE_NAV_SELECTOR = "details[data-mobile-nav]";

function closeMobileNav() {
  document.querySelectorAll(MOBILE_NAV_SELECTOR).forEach((element) => {
    if (element instanceof HTMLDetailsElement) {
      element.open = false;
    }
  });
}

function isInternalNavigation(href: string, pathname: string) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  // Same path (even with different query) — no full navigation overlay.
  if (url.pathname === pathname) return false;
  return true;
}

/**
 * The provider keys this component by pathname, so every route commit mounts a
 * fresh copy with `pending` back to false. That is what ends the overlay — and
 * it ends it after a redirect too (/connections → /network), where the clicked
 * href never matches the final path. Resetting through the key rather than a
 * `setPending(false)` on arrival keeps the reset out of an effect.
 */
function NavigationOverlay({ pathname }: { pathname: string }) {
  const [pending, setPending] = useState(false);

  // Runs once per route commit, since the key remounts this component.
  useEffect(() => {
    closeMobileNav();
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || !isInternalNavigation(href, pathname)) return;

      closeMobileNav();
      setPending(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  // Failsafe if a navigation never commits (cancelled / failed).
  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => setPending(false), 8_000);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-beedero-white/70 backdrop-blur-[2px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white px-8 py-6 shadow-lg">
        <LoadingSpinner className="size-10" label="Loading page" />
        <p className="text-sm font-semibold text-beedero-black">Loading…</p>
      </div>
    </div>
  );
}

export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {children}
      <NavigationOverlay key={pathname} pathname={pathname} />
    </>
  );
}
