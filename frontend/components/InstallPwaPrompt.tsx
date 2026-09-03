"use client";

import { useEffect, useState } from "react";
import { FiShare } from "react-icons/fi";

import {
  type BeforeInstallPromptEvent,
  type InstallPlatform,
  detectPlatform,
  isMobileUa,
  isStandaloneDisplay,
  markInstallPromptDismissed,
  wasInstallPromptRecentlyDismissed,
} from "@/lib/pwa-install";

const SHOW_DELAY_MS = 2500;

export function InstallPwaPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform] = useState<InstallPlatform>(() =>
    typeof navigator === "undefined" ? "other" : detectPlatform(navigator.userAgent),
  );

  useEffect(() => {
    if (
      !isMobileUa(navigator.userAgent) ||
      isStandaloneDisplay() ||
      wasInstallPromptRecentlyDismissed()
    ) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    markInstallPromptDismissed();
    setVisible(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:hidden">
      <div className="w-full max-w-sm rounded-2xl border border-beedero-border bg-beedero-black p-4 text-beedero-white shadow-xl">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg"
          />
          <div className="flex-1 text-sm">
            <p className="font-bold">Install Beedero</p>
            {platform === "ios" ? (
              <p className="mt-1 text-zinc-300">
                Tap <FiShare className="mb-0.5 inline size-3.5" /> Share, then{" "}
                <span className="font-semibold text-white">Add to Home Screen</span>.
              </p>
            ) : deferredPrompt ? (
              <p className="mt-1 text-zinc-300">
                Add the app for faster access and a full-screen experience.
              </p>
            ) : (
              <p className="mt-1 text-zinc-300">
                Open the browser menu and choose{" "}
                <span className="font-semibold text-white">Install app</span> or{" "}
                <span className="font-semibold text-white">Add to Home Screen</span>.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        </div>
        {deferredPrompt && platform !== "ios" && (
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-full bg-beedero-yellow px-4 py-2 text-xs font-bold text-beedero-black hover:opacity-90"
            >
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
