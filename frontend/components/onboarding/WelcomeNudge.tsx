"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { firstScreenFor, isIntent } from "@/lib/onboarding";

/**
 * The second half of §6.4's table: the sentence that goes with each first
 * screen — "completa o perfil para te candidatares mais depressa", "ativar o
 * perfil de cofundador", and so on.
 *
 * It is driven by `?welcome=<intent>` (set by `firstScreenUrl`) rather than by
 * a flag on the profile, so the landing pages stay ordinary pages: /jobs,
 * /feed and /dashboard shouldn't each grow a branch for "did this person just
 * finish onboarding". The param survives exactly one arrival — any navigation
 * from here drops it — which is the lifetime the doc gives the nudge.
 *
 * `tone` exists because the two mounts sit on different backgrounds: the app
 * shell is dark, the public board is light. `spacing` is a prop rather than a
 * fixed margin because the gap belongs to whatever this is sitting in, and a
 * wrapper div with a margin would reserve that space on every page where the
 * nudge renders nothing.
 */
export function WelcomeNudge({
  tone = "dark",
  spacing = "mb-5",
}: {
  tone?: "dark" | "light";
  spacing?: string;
}) {
  return (
    // useSearchParams client-renders its subtree on a prerendered route, so the
    // boundary is here rather than at each mount site: it is this component's
    // own requirement, not something a page should have to remember.
    <Suspense fallback={null}>
      <Nudge tone={tone} spacing={spacing} />
    </Suspense>
  );
}

function Nudge({ tone, spacing }: { tone: "dark" | "light"; spacing: string }) {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const intent = searchParams.get("welcome");
  // Only a real intent, never the routing fallback: an unknown value is a
  // hand-edited URL, and answering it with advice would be noise.
  if (dismissed || !isIntent(intent)) return null;
  const screen = firstScreenFor(intent as string);

  const dark = tone === "dark";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${spacing} ${
        dark
          ? "border border-white/15 bg-white/[0.04] text-white/80"
          : "border-2 border-beedero-border bg-beedero-white text-zinc-600"
      }`}
    >
      <p className="min-w-0 flex-1 text-sm">
        {screen.nudge}{" "}
        <Link
          href={screen.actionPath}
          className={`font-bold underline underline-offset-2 ${
            dark ? "text-beedero-yellow" : "text-beedero-black"
          }`}
        >
          {screen.actionLabel}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className={`shrink-0 rounded-full p-1 transition ${
          dark ? "hover:bg-white/10" : "hover:bg-beedero-yellow/25"
        }`}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
