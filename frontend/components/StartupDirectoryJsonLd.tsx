import { SITE_URL } from "@/lib/site-metadata";
import type { OrgSummary } from "@/lib/types";

export function StartupDirectoryJsonLd({ items }: { items: OrgSummary[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Startup directory on Beedero",
    url: `${SITE_URL}/startups`,
    numberOfItems: items.length,
    itemListElement: items.map((org, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/o/${org.slug}`,
      name: org.name,
      ...(org.one_liner ? { description: org.one_liner } : {}),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
