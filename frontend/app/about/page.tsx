import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LegalPageShell } from "@/components/LegalPageShell";
import { SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";
import { COMPANY, LEGAL_ENTITY } from "@/lib/legal-content";
import { publicFetch } from "@/lib/api";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "About Beedero",
  description:
    "Meet the team behind Beedero, our registered office in Portugal, and how to reach us — we reply within 24 hours on business days.",
  path: "/about",
});

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(COMPANY.address);

type PublicPerson = {
  person: {
    full_name: string;
    headline?: string;
    profile_picture?: string | null;
    handle: string;
  };
};

async function loadFounderPhoto(): Promise<PublicPerson["person"] | null> {
  try {
    const data = await publicFetch<PublicPerson>("/public/people/josecandido/", 3600);
    return data.person;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const founder = await loadFounderPhoto();

  return (
    <LegalPageShell title="About Beedero">
      <div className="mb-8">
        <Breadcrumbs items={[{ label: "About" }]} />
      </div>

      <p>
        Beedero is the trust network for startups and investors — verified profiles, discovery, and
        a feed for sharing milestones, events, and updates.
      </p>

      <h2>The team</h2>
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
            JV
          </span>
        )}
        <div>
          <p className="text-base font-extrabold text-zinc-900">
            {founder?.full_name ?? "José Vicente Candido"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {founder?.headline ?? "Founder · Beedero"}
          </p>
          {founder?.handle && (
            <Link
              href={`/p/${founder.handle}`}
              className="mt-3 inline-block text-sm font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              Public profile →
            </Link>
          )}
        </div>
      </div>

      <h2>How to reach us</h2>
      <p>
        <strong>Email:</strong>{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
      </p>
      <p>{SUPPORT_RESPONSE_SLA}</p>
      <p>
        <strong>Privacy:</strong>{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
      </p>

      <h2>Registered office</h2>
      <p>{COMPANY.address}</p>
      <p>
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
          Open in Google Maps — directions
        </a>
      </p>

      <h2>Legal information</h2>
      <ul>
        <li>
          <strong>Legal name:</strong> {COMPANY.name}
        </li>
        <li>
          <strong>Tax ID (NIF):</strong> {COMPANY.nif}
        </li>
        <li>
          <strong>Share capital:</strong> {COMPANY.capital}
        </li>
        <li>
          <strong>Commercial registry:</strong> {COMPANY.registry}
        </li>
      </ul>

      <p className="text-xs text-zinc-500">Last updated: {LEGAL_ENTITY.lastUpdated}.</p>
    </LegalPageShell>
  );
}
