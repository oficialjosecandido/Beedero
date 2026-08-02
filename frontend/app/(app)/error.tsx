"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isTimeout = error.message.includes("timed out");
  const isNetwork =
    isTimeout ||
    error.name === "ApiNetworkError" ||
    error.message.includes("fetch failed") ||
    error.message.includes("Could not reach the Beedero API");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-zinc-900">
        {isTimeout ? "API request timed out" : isNetwork ? "Cannot reach the API" : "Something went wrong"}
      </h1>
      <p className="max-w-lg text-sm leading-6 text-zinc-600">
        {isTimeout ? (
          <>
            The backend did not respond within 15 seconds. If you are developing locally, set{" "}
            <code className="rounded bg-zinc-100 px-1">BACKEND_URL=http://localhost:8000/api</code> in{" "}
            <code className="rounded bg-zinc-100 px-1">frontend/.env</code> and make sure Django is
            running (<code className="rounded bg-zinc-100 px-1">python manage.py runserver</code>).
            The Azure API may also be cold-starting — try again in a minute or use the local backend.
          </>
        ) : isNetwork ? (
          <>
            Check <code className="rounded bg-zinc-100 px-1">BACKEND_URL</code> in{" "}
            <code className="rounded bg-zinc-100 px-1">frontend/.env</code> and that the API is
            reachable.
          </>
        ) : (
          error.message || "An unexpected error occurred."
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
          href="/feed"
          className="rounded-xl border border-beedero-border px-5 py-2.5 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow/20"
        >
          Back to feed
        </Link>
      </div>
    </main>
  );
}
