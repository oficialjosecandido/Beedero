import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LegalPageShell } from "@/components/LegalPageShell";
import { COMPANY, LEGAL_ENTITY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Legal information",
  description:
    "Legal identification for Beedero: company name, tax ID, share capital, commercial registry and registered office, as required by Decree-Law 7/2004.",
  path: "/legal-information",
  keywords: ["Beedero legal information", "Poetic Clouds", "registered office"],
});

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(COMPANY.address);

/**
 * The DL 7/2004 identification block, on a page of its own. It used to share
 * /about with the person behind Beedero, where the tax ID and the share
 * capital were the first thing anyone read about the company.
 */
export default function LegalInformationPage() {
  return (
    <LegalPageShell title="Legal information" current="/legal-information">
      <div className="mb-8">
        <Breadcrumbs items={[{ label: "Legal information" }]} />
      </div>

      <h2>Identification</h2>
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
        <li>
          <strong>Email:</strong> <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
        </li>
      </ul>

      <h2>Registered office</h2>
      <p>{COMPANY.address}</p>
      <p>
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
          Open in Google Maps — directions
        </a>
      </p>

      <p className="text-xs text-zinc-500">Last updated: {LEGAL_ENTITY.lastUpdated}.</p>
    </LegalPageShell>
  );
}
