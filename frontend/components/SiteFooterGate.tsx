"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Marketing landing pages ship their own dark footer; hide the global one
 *  there — and in the Nexus, which is an internal tool, not a page of the site. */
export function SiteFooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/pricing" || pathname === "/cases") return null;
  if (pathname.startsWith("/beedero-nexus")) return null;
  return children;
}
