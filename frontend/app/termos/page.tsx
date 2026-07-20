import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { TERMS_OF_SERVICE_MARKDOWN } from "../terms/content";

export const metadata: Metadata = pageMetadata({
  title: "Termos e Condições",
  description: "Termos e condições de utilização da plataforma Beedero.",
  path: "/termos",
});

export default function TermosPage() {
  return (
    <LegalDocument
      title="Termos e Condições"
      content={prepareLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN)}
      draft={false}
    />
  );
}
