import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";

import { TERMS_OF_SERVICE_MARKDOWN } from "./content";

export const metadata: Metadata = {
  title: "Terms of Service — Beedero",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      content={prepareLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN)}
      draft={false}
    />
  );
}
