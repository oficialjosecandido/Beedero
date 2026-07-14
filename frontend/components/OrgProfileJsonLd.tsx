import { SITE_URL } from "@/lib/site-metadata";
import type { OrgSummary } from "@/lib/types";

export function OrgProfileJsonLd({ org }: { org: OrgSummary }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    url: `${SITE_URL}/o/${org.slug}`,
    ...(org.one_liner ? { description: org.one_liner } : {}),
    ...(org.logo ? { logo: org.logo } : {}),
    ...(org.sector ? { industry: org.sector } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
