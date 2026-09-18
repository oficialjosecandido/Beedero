import type { Metadata } from "next";
import Link from "next/link";

import { EmailLinkForm } from "@/components/EmailLinkForm";
import { authErrorMessage, safeNextPath } from "@/lib/firebase-auth";
import { getPendingConfirmation } from "@/lib/session";
import { noIndexMetadata, pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Log in",
    description: "Sign in to your Beedero account to manage your startup profile, feed, and discovery.",
    path: "/login",
  }),
  ...noIndexMetadata,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; confirm?: string }>;
}) {
  const { next, error } = await searchParams;
  // The callback route parks the one-time code here when a link is opened on a
  // browser that never saw the send. Its presence — not the query string — is
  // what puts the form in confirm mode.
  const awaitingConfirmation = Boolean(await getPendingConfirmation());

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {awaitingConfirmation ? "Confirm your email" : "Log in"}
          </h1>
        </div>
        <EmailLinkForm
          mode={awaitingConfirmation ? "confirm" : "send"}
          next={safeNextPath(next)}
          submitLabel={awaitingConfirmation ? "Confirm and sign in" : "Email me a sign-in code"}
          initialError={authErrorMessage(error)}
        />
        {!awaitingConfirmation && (
          <p className="text-center text-sm text-zinc-600">
            New here? The same code creates your account —{" "}
            <Link
              href="/register"
              className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              see what you get
            </Link>
            .
          </p>
        )}
        <p className="text-center text-xs text-zinc-500">
          <Link href="/terms" className="underline underline-offset-2 hover:text-beedero-black">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-beedero-black">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}
