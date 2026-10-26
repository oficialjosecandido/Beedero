"use client";

import { useEffect } from "react";

export type BadgeCounts = {
  notifications: { unread_count: number };
  messages: { unread_count: number };
  network: { connections: number; pending: number; following: number };
};

/** How often the chrome refreshes its badges while the tab is visible. */
const POLL_INTERVAL_MS = 60_000;

type Listener = (counts: BadgeCounts) => void;

/**
 * One poll for every badge in the app chrome.
 *
 * The notifications, messaging and network contexts each used to run their
 * own `useVisiblePolling` timer against their own endpoint, so an idle
 * signed-in tab spent five requests a minute — five authentications, five
 * database round trips — fetching five integers. They now all subscribe
 * here: one timer, one request to /api/me/badges, shared by every subscriber
 * wherever it sits in the tree (the three providers mount in different
 * layouts, so module state is the only thing they have in common).
 *
 * This is the *steady-state* poll. A mutation that changes one counter still
 * refreshes that counter through its own endpoint — immediately, and without
 * asking for the other four.
 */
const listeners = new Set<Listener>();
let timer: number | undefined;
let inFlight: Promise<void> | null = null;
let latest: BadgeCounts | null = null;

async function load(): Promise<void> {
  try {
    const res = await fetch("/api/me/badges", { cache: "no-store" });
    if (!res.ok) return;
    const counts = (await res.json()) as BadgeCounts;
    latest = counts;
    for (const listener of listeners) listener(counts);
  } catch {
    // ignore polling errors
  }
}

function poll(): Promise<void> {
  // Three providers mounting in the same tick, or a tab becoming visible
  // just as the interval fires, must not become three requests.
  if (!inFlight) {
    inFlight = load().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function start() {
  if (timer !== undefined) return;
  void poll();
  timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
}

function stop() {
  if (timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
}

function syncToVisibility() {
  if (listeners.size === 0) return;
  if (document.visibilityState === "visible") {
    start();
  } else {
    stop();
  }
}

/** Subscribes to the shared poll; returns the unsubscribe function. */
export function subscribeToBadgeCounts(listener: Listener): () => void {
  listeners.add(listener);
  // A provider that mounts later starts from what the others already have,
  // rather than showing zeros until the next tick.
  if (latest) listener(latest);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", syncToVisibility);
  }
  syncToVisibility();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stop();
    document.removeEventListener("visibilitychange", syncToVisibility);
    // Nobody is showing badges any more — most likely a sign-out. Dropping
    // the cache keeps one account's counters from flashing up for the next.
    latest = null;
  };
}

/** Re-reads every badge now, outside the interval. Shared with any poll
 * already in flight, so calling it from several places is free. */
export function refreshBadgeCounts(): Promise<void> {
  return poll();
}

/** Calls `onCounts` with every badge payload the shared poll receives. Pass
 * a stable (useCallback'd) function — a new one resubscribes. */
export function useBadgeCounts(onCounts: Listener) {
  useEffect(() => subscribeToBadgeCounts(onCounts), [onCounts]);
}
