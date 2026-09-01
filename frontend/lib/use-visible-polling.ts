"use client";

import { useEffect } from "react";

type VisiblePollingOptions = {
  /** Called immediately on mount and whenever the tab becomes visible again. */
  onPoll: () => void | Promise<void>;
  /** Interval between polls while the tab is visible. */
  intervalMs: number;
  enabled?: boolean;
};

/** Runs `onPoll` on an interval only while the browser tab is visible. */
export function useVisiblePolling({ onPoll, intervalMs, enabled = true }: VisiblePollingOptions) {
  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const runPoll = () => {
      void onPoll();
    };

    const start = () => {
      if (timer !== undefined) return;
      runPoll();
      timer = window.setInterval(runPoll, intervalMs);
    };

    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, onPoll]);
}
