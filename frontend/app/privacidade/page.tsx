import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { PRIVACY_POLICY_MARKDOWN } from "../privacy/content";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Beedero collects, uses, and protects your personal data.",
  path: "/privacidade",
});

export default function PrivacidadePage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      content={prepareLegalMarkdown(PRIVACY_POLICY_MARKDOWN)}
      draft={false}
    />
  );
}
