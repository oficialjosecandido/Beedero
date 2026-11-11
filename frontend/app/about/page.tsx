import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FOUNDER_NOTE } from "@/components/landing/landing-content";
import { LegalPageShell } from "@/components/LegalPageShell";
import { loadFounder } from "@/lib/founder";
import { COMPANY } from "@/lib/legal-content";
import { ONE_LINER } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "About Beedero",
  description: `${ONE_LINER} Built in Portugal. Who is behind it, and how to reach us.`,
  path: "/about",
  keywords: ["About Beedero", "Portugal startup network", "verified startup network"],
});

export default async function AboutPage() {
  const founder = await loadFounder();

  return (
    <LegalPageShell title="About Beedero" current="/about">
      <div className="mb-8">
        <Breadcrumbs items={[{ label: "About" }]} />
      </div>

      <p>{ONE_LINER}</p>

      <h2>Who is behind it</h2>
      <div className="not-prose mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {founder?.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.profile_picture}
            alt={`${founder.full_name}, founder of Beedero`}
            width={112}
            height={112}
            className="size-28 shrink-0 rounded-2xl border border-beedero-border object-cover"
          />
        ) : (
          <span
            className="grid size-28 shrink-0 place-items-center rounded-2xl border border-beedero-border bg-zinc-100 text-2xl font-black text-beedero-black"
            aria-hidden
          >
            JC
          </span>
        )}
        <div>
          <p className="text-base font-extrabold text-zinc-900">
            {founder?.full_name ?? FOUNDER_NOTE.name}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{founder?.headline ?? FOUNDER_NOTE.role}</p>
          <p className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
            {founder?.handle && (
              <Link
                href={`/p/${founder.handle}`}
                className="text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
              >
                Profile on Beedero
              </Link>
            )}
            {FOUNDER_NOTE.linkedin && (
              <a
                href={FOUNDER_NOTE.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
              >
                LinkedIn
              </a>
            )}
          </p>
        </div>
      </div>

      {/* Renders once there is a real note — see components/landing/landing-content.ts. */}
      {FOUNDER_NOTE.body && <p className="mt-6">{FOUNDER_NOTE.body}</p>}

      <h2>How to reach us</h2>
      <p>
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> — support, privacy and
        anything else. It is one mailbox and it is read.
      </p>

      <h2>The company</h2>
      <p>
        Beedero is run by {COMPANY.name}, registered in Portugal.{" "}
        <Link href="/legal-information">Registered office and legal details</Link>.
      </p>
    </LegalPageShell>
  );
}
