import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

import { PRIVACY_POLICY_MARKDOWN } from "./content";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Beedero collects, uses, and protects your personal data and startup profile information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      content={prepareLegalMarkdown(PRIVACY_POLICY_MARKDOWN)}
      draft={false}
    />
  );
}
