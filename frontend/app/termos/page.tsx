import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { TERMS_OF_SERVICE_MARKDOWN } from "../terms/content";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "Terms and conditions for using the Beedero platform.",
  path: "/termos",
});

export default function TermosPage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      content={prepareLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN)}
      draft={false}
    />
  );
}
