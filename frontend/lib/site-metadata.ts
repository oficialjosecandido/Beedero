import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beedero.com";

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Beedero",
    template: "%s · Beedero",
  },
  description: "Structured startup profiles, verified credibility, and a live feed for founders and investors.",
  openGraph: {
    type: "website",
    siteName: "Beedero",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Beedero" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export function orgProfileMetadata(org: { name: string; one_liner?: string | null }): Metadata {
  const title = org.name;
  const description = org.one_liner || `${org.name} on Beedero`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} · Beedero`,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Beedero" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Beedero`,
      description,
      images: ["/og.png"],
    },
  };
}
