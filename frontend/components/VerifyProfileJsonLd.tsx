import { SITE_URL } from "@/lib/site-metadata";

type VerifyJsonLdInput = {
  slug: string;
  name: string;
  one_liner?: string | null;
  logo?: string | null;
};

export function VerifyProfileJsonLd({
  org,
  badge,
}: {
  org: VerifyJsonLdInput;
  badge: { visual_status: string; level: number };
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${org.name} — Beedero verification`,
    url: `${SITE_URL}/verify/${org.slug}`,
    description:
      org.one_liner?.trim() ||
      `Public verification status for ${org.name} on Beedero.`,
    about: {
      "@type": "Organization",
      name: org.name,
      url: `${SITE_URL}/o/${org.slug}`,
      ...(org.logo ? { logo: org.logo } : {}),
      ...(org.one_liner ? { description: org.one_liner } : {}),
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "verification_status", value: badge.visual_status },
      { "@type": "PropertyValue", name: "credibility_level", value: String(badge.level) },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
