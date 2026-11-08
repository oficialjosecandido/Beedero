import { jsonLdHtml } from "@/lib/json-ld";
import { LEGAL_ENTITY } from "@/lib/legal-content";
import { DEFAULT_DESCRIPTION, SEO_PERSONAS, SITE_NAME } from "@/lib/seo-content";
import { SITE_URL } from "@/lib/site-metadata";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
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
  name: SITE_NAME,
  legalName: LEGAL_ENTITY.legalName,
  url: SITE_URL,
  logo: `${SITE_URL}/og.png`,
  email: LEGAL_ENTITY.contactEmail,
  taxID: LEGAL_ENTITY.nif,
  sameAs: SEO_PERSONAS.map((persona) => `${SITE_URL}${persona.path}`),
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

/** Product-level schema so rich results can surface free personal + paid org plans. */
const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  offers: [
    {
      "@type": "Offer",
      name: "Personal account",
      price: "0",
      priceCurrency: "EUR",
      description: "Free verified professional profile for founders, talent, advisors and investors.",
      url: `${SITE_URL}/for-professionals`,
    },
    {
      "@type": "Offer",
      name: "Startup organisation",
      price: "33.00",
      priceCurrency: "EUR",
      priceValidUntil: "2027-12-31",
      description:
        "Pre-incorporation startup workspace — €33/year or €3/month, VAT included. First year free with EARLYADOPTER.",
      url: `${SITE_URL}/for-startups`,
    },
    {
      "@type": "Offer",
      name: "Company organisation",
      price: "99.00",
      priceCurrency: "EUR",
      priceValidUntil: "2027-12-31",
      description:
        "Incorporated company workspace — €99/year or €9/month, VAT included. First year free with EARLYADOPTER.",
      url: `${SITE_URL}/for-companies`,
    },
  ],
};

export function WebsiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(softwareJsonLd) }}
      />
    </>
  );
}
