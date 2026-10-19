import { LEGAL_ENTITY } from "@/lib/legal-content";
import { SITE_URL } from "@/lib/site-metadata";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Beedero",
  url: SITE_URL,
  description:
    "Structured startup profiles, verified credibility, and a live feed for founders, investors, and researchers.",
  inLanguage: "en",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/startups?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Beedero",
  legalName: LEGAL_ENTITY.legalName,
  url: SITE_URL,
  logo: `${SITE_URL}/og.png`,
  email: LEGAL_ENTITY.contactEmail,
  taxID: LEGAL_ENTITY.nif,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua da Fontainha 7",
    postalCode: "2640-019",
    addressLocality: "Santo Isidoro",
    addressCountry: "PT",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: LEGAL_ENTITY.contactEmail,
    availableLanguage: ["English", "Portuguese"],
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    description: "We reply within 24 hours on business days.",
  },
};

export function WebsiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
    </>
  );
}
