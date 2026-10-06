"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function OrgDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isNetwork =
    error.name === "ApiNetworkError" ||
    error.message.includes("fetch failed") ||
    error.message.includes("Could not reach the Beedero API");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-zinc-900">
        {isNetwork ? "Cannot reach the API" : "Something went wrong"}
      </h1>
      <p className="max-w-lg text-sm leading-6 text-zinc-600">
        {isNetwork ? (
          <>
            The app could not connect to the backend (
            <code className="rounded bg-zinc-100 px-1">BACKEND_URL</code> in{" "}
            <code className="rounded bg-zinc-100 px-1">.env</code>). This is usually a network or DNS
            issue — try another connection, disable VPN, or set{" "}
            <code className="rounded bg-zinc-100 px-1">
              BACKEND_URL=https://beedero-api.azurewebsites.net/api
            </code>
            .
          </>
        ) : (
          error.message || "An unexpected error occurred while loading this organization."
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl border border-beedero-border px-5 py-2.5 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
