import type { Metadata } from "next";

import { AuthContinueClient } from "@/components/AuthContinueClient";
import { safeNextPath } from "@/lib/firebase-auth";
import { noIndexMetadata, pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Continue",
    description: "Finish signing in to Beedero.",
    path: "/auth/continue",
  }),
  ...noIndexMetadata,
};

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Almost there</h1>
        </div>
        <AuthContinueClient next={destination} />
      </div>
    </main>
  );
}
