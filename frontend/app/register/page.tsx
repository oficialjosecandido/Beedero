import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmailLinkForm } from "@/components/EmailLinkForm";
import { authErrorMessage, safeNextPath } from "@/lib/firebase-auth";
import { getPendingConfirmation } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";
import { safeRef } from "@/lib/signup-ref";

export const metadata: Metadata = pageMetadata({
  title: "Join Beedero free — verified founder and professional profiles",
  description:
    "Create a free Beedero account. Prove founder status, get organisation-confirmed roles, find co-founders, and discover verified startups and jobs — without cold spam.",
  path: "/register",
  keywords: [
    "join Beedero",
    "free professional profile",
    "verified founder",
    "co-founder matching",
    "startup network signup",
  ],
});

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string; next?: string }>;
}) {
  const { error, ref, next } = await searchParams;
  // `ref` says which channel sent them (§7–§8 of the acquisition doc);
  // `next` is where they were headed, so somebody who clicked "apply" on a job
  // lands back on that job rather than on a generic feed.
  const signupRef = safeRef(ref);
  const destination = safeNextPath(next);

  // Sign-in and sign-up are the same act now: the first link sent to an
  // address creates the account. This page exists for the framing (and the
  // landing page's CTA), but the confirm step belongs on one page only.
  if (await getPendingConfirmation()) {
    redirect(`/login?confirm=1&next=${encodeURIComponent(destination)}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Join Beedero free</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Founders, talent, advisors and investors — free personal profiles with organisation-confirmed
            credibility. Organisations start from €33/year.
          </p>
        </div>
        <EmailLinkForm
          mode="send"
          next={destination}
          signupRef={signupRef}
          submitLabel="Email me a sign-up code"
          initialError={authErrorMessage(error)}
          thanksPath="/thanks"
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
