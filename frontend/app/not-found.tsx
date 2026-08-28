import Link from "next/link";

import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = {
  title: "Page not found",
  ...noIndexMetadata,
};

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">404</p>
      <h1 className="mt-3 text-3xl font-extrabold text-zinc-950">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
        This page doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
        >
          Home
        </Link>
        <Link
          href="/startups"
          className="rounded-full border border-beedero-border px-5 py-2.5 text-sm font-semibold text-beedero-black hover:bg-zinc-50"
        >
          Browse startups
        </Link>
      </div>
    </main>
  );
}
