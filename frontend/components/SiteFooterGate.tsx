"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** One footer on every public page (components/Footer.tsx) — the landing used
 *  to ship a second one of its own. The Nexus is an internal tool, not a page
 *  of the site, so it has none. */
export function SiteFooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/beedero-nexus")) return null;
  return children;
}
