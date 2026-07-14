import { SITE_URL } from "@/lib/site-metadata";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Beedero",
  url: SITE_URL,
  description:
    "Structured startup profiles, verified credibility, and a live feed for founders, investors, and researchers.",
  inLanguage: "en",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Beedero",
  url: SITE_URL,
  logo: `${SITE_URL}/og.png`,
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
