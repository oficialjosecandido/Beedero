"use client";

import { useEffect } from "react";

import { useNotifications } from "@/lib/notifications-context";

/**
 * Profile landing for newsletter consent — linked from the email footer's
 * "Manage preferences". Lives here (not only in the notifications modal)
 * so a cold click from an inbox lands on a stable settings URL.
 */
export function EmailPreferencesSection() {
  const { prefs, loadPreferences, updatePreference } = useNotifications();

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const checked = prefs.newsletter_opt_in;

  return (
    <section
      id="email-preferences"
      aria-labelledby="email-preferences-title"
      className="scroll-mt-24 border border-white/10 p-5 sm:p-7"
    >
      <h2 id="email-preferences-title" className="text-sm font-black uppercase tracking-[0.14em] text-white/55">
        Email preferences
      </h2>
      <p className="mt-2 text-sm text-white/45">Choose which Beedero emails you want in your inbox.</p>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => void updatePreference("newsletter_opt_in", !checked)}
        className="mt-5 flex w-full max-w-md items-center gap-3 text-left"
      >
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            checked ? "bg-beedero-yellow" : "bg-white/15"
          }`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full transition-[left] ${
              checked ? "left-4 bg-beedero-black" : "left-0.5 bg-white/70"
            }`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-xs">Beedero newsletter</b>
          <small className="mt-0.5 block text-[10px] leading-4 text-white/40">
            What&apos;s new on Beedero, about once a month
          </small>
        </span>
      </button>
    </section>
  );
}
