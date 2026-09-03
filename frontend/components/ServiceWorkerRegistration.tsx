"use client";

import { useEffect } from "react";

import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase-config";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Firebase web config isn't secret, but it's still only known at
    // request/build time via NEXT_PUBLIC_ env vars — public/sw.js is a
    // static file with no template step, so it's passed in as a query
    // param and read via self.location.search inside the worker.
    const swUrl = isFirebaseConfigured()
      ? `/sw.js?fcfg=${encodeURIComponent(JSON.stringify(firebaseConfig))}`
      : "/sw.js";

    navigator.serviceWorker.register(swUrl).catch(() => {
      // Installability/offline shell/push are progressive enhancements —
      // a failed registration should never block the app.
    });
  }, []);

  return null;
}
