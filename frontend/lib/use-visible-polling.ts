"use client";

import { useEffect } from "react";

type VisiblePollingOptions = {
  /** Called immediately on mount and whenever the tab becomes visible again. */
  onPoll: () => void | Promise<void>;
  /** Interval between polls while the tab is visible. */
  intervalMs: number;
  enabled?: boolean;
  /** Wait this long before the first poll so critical page work can finish first. */
  deferMs?: number;
};

/** Runs `onPoll` on an interval only while the browser tab is visible. */
export function useVisiblePolling({
  onPoll,
  intervalMs,
  enabled = true,
  deferMs = 0,
}: VisiblePollingOptions) {
  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;
    let deferTimer: number | undefined;

    const runPoll = () => {
      void onPoll();
    };

    const start = () => {
      if (timer !== undefined || deferTimer !== undefined) return;
      const begin = () => {
        deferTimer = undefined;
        runPoll();
        timer = window.setInterval(runPoll, intervalMs);
      };
      if (deferMs > 0) {
        deferTimer = window.setTimeout(begin, deferMs);
      } else {
        begin();
      }
    };

    const stop = () => {
      if (deferTimer !== undefined) {
        window.clearTimeout(deferTimer);
        deferTimer = undefined;
      }
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
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
  }, [enabled, intervalMs, deferMs, onPoll]);
}
