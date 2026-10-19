import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmailLinkForm } from "@/components/EmailLinkForm";
import { SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";
import { safeNextPath } from "@/lib/firebase-auth";
import { COMPANY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";
import { safeRef } from "@/lib/signup-ref";

export const metadata: Metadata = pageMetadata({
  title: "Thanks — check your email",
  description:
    "Your Beedero sign-up email is on the way. Enter the code to finish joining the network.",
  path: "/thanks",
  index: false,
  follow: false,
});

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; ref?: string }>;
}) {
  const { email, next, ref } = await searchParams;
  const destination = safeNextPath(next);
  const signupRef = safeRef(ref);
  const sentTo = (email ?? "").trim().slice(0, 254);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <Breadcrumbs items={[{ label: "Thanks" }]} />
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            You’re in
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Thanks for joining.</h1>
          <p className="mt-2 text-sm text-zinc-600">
            One code away from your professional record. {SUPPORT_RESPONSE_SLA}
          </p>
        </div>

        {sentTo ? (
          <EmailLinkForm
            mode="send"
            next={destination}
            signupRef={signupRef}
            submitLabel="Email me a sign-up code"
            initialSentEmail={sentTo}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600">
              Start from the join form so we know where to send your code.
            </p>
            <Link
              href="/register"
              className="rounded-full bg-beedero-black px-4 py-3 text-center text-sm font-semibold text-beedero-yellow"
            >
              Back to join
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-zinc-500">
          Questions?{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="font-medium underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            {COMPANY.contactEmail}
          </a>{" "}
          · {SUPPORT_RESPONSE_SLA}
        </p>
      </div>
    </main>
  );
}
