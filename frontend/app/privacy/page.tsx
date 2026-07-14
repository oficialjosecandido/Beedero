import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { prepareLegalMarkdown } from "@/lib/legal-content";

import { PRIVACY_POLICY_MARKDOWN } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy — Beedero",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      content={prepareLegalMarkdown(PRIVACY_POLICY_MARKDOWN)}
      draft={false}
    />
  );
}
