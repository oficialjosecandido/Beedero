import { SITE_URL } from "@/lib/site-metadata";

type PersonJsonLdInput = {
  handle: string;
  full_name: string;
  headline?: string;
  profile_picture?: string | null;
  country?: string;
};

export function PersonProfileJsonLd({ person }: { person: PersonJsonLdInput }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: person.full_name,
      url: `${SITE_URL}/p/${person.handle}`,
      ...(person.headline ? { jobTitle: person.headline } : {}),
      ...(person.profile_picture ? { image: person.profile_picture } : {}),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
