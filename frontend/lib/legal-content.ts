export const LEGAL_ENTITY = {
  companyName: "Poetic Clouds, Unipessoal Lda",
  legalName: "Poetic Clouds, Unipessoal Lda",
  address: "Rua da Fontainha 7, 2640-019 Santo Isidoro",
  registryLocation: "Conservatória do Registo Comercial de Lisboa",
  nif: "517988615",
  shareCapital: "100,00 €",
  privacyEmail: "privacy@beedero.com",
  contactEmail: "hello@beedero.com",
  lastUpdated: "31 August 2026",
  profileViewRetention: "12 months",
  auditRetention: "24 months",
  verificationDocRetention: "24 months after verification or account deletion, whichever comes first",
} as const;

/** Footer + DL 7/2004 identification block. */
export const COMPANY = {
  name: LEGAL_ENTITY.legalName,
  nif: LEGAL_ENTITY.nif,
  address: LEGAL_ENTITY.address,
  capital: LEGAL_ENTITY.shareCapital,
  registry: LEGAL_ENTITY.registryLocation,
  contactEmail: LEGAL_ENTITY.contactEmail,
  privacyEmail: LEGAL_ENTITY.privacyEmail,
} as const;

export function prepareLegalMarkdown(source: string): string {
  let text = source
    .replace(/\{date\}/g, LEGAL_ENTITY.lastUpdated)
    .replace(/\{legal company name\}/g, LEGAL_ENTITY.companyName)
    .replace(/\{address\}/g, LEGAL_ENTITY.address)
    .replace(/\{NIF\}/g, LEGAL_ENTITY.nif)
    .replace(/\{location\}/g, LEGAL_ENTITY.registryLocation)
    .replace(/\{email — e\.g\. privacy@beedero\.com\}/g, LEGAL_ENTITY.privacyEmail)
    .replace(/\{email\}/g, LEGAL_ENTITY.contactEmail)
    .replace(/\{12 months\}/g, LEGAL_ENTITY.profileViewRetention)
    .replace(/\{24 months\}/g, LEGAL_ENTITY.auditRetention)
    .replace(
      /\{X — proposed: 24 months after verification or until account deletion, whichever comes first\}/g,
      LEGAL_ENTITY.verificationDocRetention,
    )
    .replace(/\{Sentry or equivalent\}/g, "Sentry")
    .replace(/\{monthly\}/g, "monthly")
    .replace(/\{Lisbon\}/g, "Lisbon")
    .replace(/\{30 days\}/g, "30 days")
    .replace(/\{applicable ADR body\}/g, "the applicable consumer arbitration centre in Portugal")
    .replace(/\{12m\}/g, "12 months")
    .replace(/\{24m\}/g, "24 months")
    .replace(
      /\{path in the app \/ by request to email\}/g,
      "your account settings or by email to privacy@beedero.com",
    );

  text = text.replace(/\[LEGAL REVIEW:[^\]]*\]\n?/g, "");
  text = text.replace(/> ⚠️ INTERNAL NOTE[^\n]*\n\n?/g, "");
  text = text.replace(/\{[^}]+\}/g, (match) => match.slice(1, -1));

  return text.trim();
}
