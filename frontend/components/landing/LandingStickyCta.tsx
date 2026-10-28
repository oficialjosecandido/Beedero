"use client";

import { useEffect, useState } from "react";

import { LandingPrimaryLink } from "./LandingPrimaryLink";

export function LandingStickyCta({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    function onScroll() {
      // After the hero CTA leaves the viewport, keep a mobile conversion bar.
      setShowStickyCta(window.scrollY > 420);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-beedero-yellow/40 bg-[#070806]/95 p-3 backdrop-blur transition-all md:hidden ${
        showStickyCta ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <LandingPrimaryLink
        href={primaryHref}
        className="flex w-full items-center justify-center rounded-full bg-beedero-yellow py-3.5 text-sm font-black uppercase text-beedero-black"
      >
        {primaryLabel === "Enter Beedero" ? "Enter Beedero" : "Join free"} →
      </LandingPrimaryLink>
    </div>
  );
}
