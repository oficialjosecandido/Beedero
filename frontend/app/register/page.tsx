import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmailLinkForm } from "@/components/EmailLinkForm";
import { authErrorMessage } from "@/lib/firebase-auth";
import { getPendingConfirmation } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Create account",
  description:
    "Join Beedero — then connect to your startup or start investing. Build structured profiles and discover verified opportunities.",
  path: "/register",
});

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Sign-in and sign-up are the same act now: the first link sent to an
  // address creates the account. This page exists for the framing (and the
  // landing page's CTA), but the confirm step belongs on one page only.
  if (await getPendingConfirmation()) {
    redirect("/login?confirm=1");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Join Beedero</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Founders, experts, investors and the organisations they build. Free to join.
          </p>
        </div>
        <EmailLinkForm
          mode="send"
          next="/feed"
          submitLabel="Email me a sign-up link"
          initialError={authErrorMessage(error)}
        />
        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Log in
          </Link>
        </p>
        <p className="text-center text-xs text-zinc-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-beedero-black">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-beedero-black">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
