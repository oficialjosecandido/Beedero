import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { PRIVACY_POLICY_MARKDOWN } from "../privacy/content";

export const metadata: Metadata = pageMetadata({
  title: "Política de Privacidade",
  description: "Como a Beedero recolhe, utiliza e protege os teus dados pessoais.",
  path: "/privacidade",
});

export default function PrivacidadePage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      content={prepareLegalMarkdown(PRIVACY_POLICY_MARKDOWN)}
      draft={false}
    />
  );
}
