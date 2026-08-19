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

function routeKey(pathname: string) {
  return pathname;
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
  if (routeKey(url.pathname) === routeKey(pathname)) return false;
  return true;
}

export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const isNavigating = pendingRoute !== null && pendingRoute !== pathname;

  useEffect(() => {
    closeMobileNav();
  }, [pathname]);

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

      const url = new URL(href, window.location.origin);
      closeMobileNav();
      setPendingRoute(routeKey(url.pathname));
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  useEffect(() => {
    if (!isNavigating) return;
    const timeout = window.setTimeout(() => setPendingRoute(null), 30_000);
    return () => window.clearTimeout(timeout);
  }, [isNavigating]);

  return (
    <>
      {children}
      {isNavigating && (
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
      )}
    </>
  );
}
