import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { TERMS_OF_SERVICE_MARKDOWN } from "./content";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "Terms of Service for using Beedero — the startup discovery platform for founders and investors.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      content={prepareLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN)}
      draft={false}
    />
  );
}
