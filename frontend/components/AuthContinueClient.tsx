"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import {
  detectPlatform,
  isStandaloneDisplay,
  subscribeToDisplayMode,
  unknownDisplayMode,
} from "@/lib/pwa-install";

type Props = {
  next: string;
};

/**
 * Post-magic-link landing. Email clients almost always open the link in a
 * browser tab — on Android/Chrome we try to hand off into the installed PWA;
 * on iOS (separate cookie jar) we explain how to finish inside the app.
 */
export function AuthContinueClient({ next }: Props) {
  const router = useRouter();
  // null until hydration has run — same three states as before, without the
  // extra render pass that setting them in an effect cost.
  const inPwa = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandaloneDisplay,
    unknownDisplayMode
  );
  // Only read on the client: while inPwa is null we're still rendering the
  // server's markup, where there is no navigator.
  const platform = inPwa === null ? "other" : detectPlatform(navigator.userAgent);

  useEffect(() => {
    if (inPwa === null) return;

    if (inPwa) {
      router.replace(next);
      return;
    }

    // Chromium: prefer focusing/navigating an existing installed PWA window.
    // launch_handler in the manifest does the heavy lifting when the OS routes
    // the original email URL here; this is a best-effort follow-up.
    const androidIntent = buildAndroidIntent(next);
    if (androidIntent) {
      window.location.replace(androidIntent);
    }
  }, [inPwa, next, router]);

  if (inPwa === null || inPwa) {
    return (
      <p className="text-sm text-zinc-600" role="status">
        Signing you in…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-beedero-black bg-beedero-yellow/20 px-4 py-4">
        <p className="text-sm font-bold">You&apos;re signed in</p>
        <p className="mt-1 text-sm text-zinc-700">
          {platform === "ios"
            ? "On iPhone, email links open in Safari — not the Beedero app. Open Beedero from your home screen; if it asks you to sign in again, request a link there and paste it into the app."
            : "If you installed Beedero, open it from your home screen to continue there. Otherwise you can keep using this browser."}
        </p>
      </div>
      <Link
        href={next}
        className="rounded-full bg-beedero-black px-4 py-3 text-center text-sm font-semibold text-beedero-yellow hover:bg-beedero-black/90"
      >
        Continue in browser
      </Link>
      {platform === "ios" && (
        <Link
          href="/login"
          className="text-center text-sm font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
        >
          Open login in case you need a fresh link
        </Link>
      )}
    </div>
  );
}

function buildAndroidIntent(next: string): string | null {
  if (typeof window === "undefined") return null;
  if (!/Android/i.test(navigator.userAgent)) return null;

  const absolute = new URL(next, window.location.origin).href;
  // Open the HTTPS URL via an intent so Chrome can hand it to the installed PWA
  // when launch_handler / link capture is available.
  return `intent://${absolute.replace(/^https?:\/\//, "")}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
}
