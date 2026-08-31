import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { COMPANY, LEGAL_ENTITY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "About Beedero",
  description: "Information about Beedero and the company's legal identification.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalPageShell title="About Beedero">
      <p>
        Beedero is the trust network for startups and investors — verified profiles,
        discovery, and a feed for sharing milestones, events, and updates.
      </p>

      <h2>Legal information</h2>
      <ul>
        <li>
          <strong>Legal name:</strong> {COMPANY.name}
        </li>
        <li>
          <strong>Registered office:</strong> {COMPANY.address}
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
          <strong>Contact:</strong>{" "}
          <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
        </li>
        <li>
          <strong>Privacy:</strong>{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
        </li>
      </ul>

      <p className="text-xs text-zinc-500">Last updated: {LEGAL_ENTITY.lastUpdated}.</p>
    </LegalPageShell>
  );
}
