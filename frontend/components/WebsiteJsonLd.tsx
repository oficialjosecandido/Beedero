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
  taxID: LEGAL_ENTITY.nif,
  address: {
    "@type": "PostalAddress",
    streetAddress: LEGAL_ENTITY.address,
    addressCountry: "PT",
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
