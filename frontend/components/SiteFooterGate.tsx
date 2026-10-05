"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Marketing landing pages ship their own dark footer; hide the global one there. */
export function SiteFooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/pricing") return null;
  return children;
}
