import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";

import { PRIVACY_POLICY_MARKDOWN } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy — Beedero",
};

export default function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" content={PRIVACY_POLICY_MARKDOWN} />;
}
