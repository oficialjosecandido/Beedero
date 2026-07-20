import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://beedero.com").replace(/\/$/, "");

const SITE_NAME = "Beedero";

const DEFAULT_DESCRIPTION =
  "Structured startup profiles, verified credibility, and a live feed for founders, investors, and researchers.";

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Beedero — structured startup profiles for founders and investors",
} as const;

export const SITE_ICONS = {
  icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  shortcut: "/favicon.svg",
  apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
};

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMetadataOptions = {
  title: string;
  description?: string;
  path: string;
  index?: boolean;
  image?: { url: string; width?: number; height?: number; alt: string };
};

export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  index = true,
  image = OG_IMAGE,
}: PageMetadataOptions): Metadata {
  const openGraphUrl = absoluteUrl(path);
  const twitterImage = image.url.startsWith("http") ? image.url : absoluteUrl(image.url);

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${title} · ${SITE_NAME}`,
      description,
      url: openGraphUrl,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
      images: [twitterImage],
    },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Startup discovery for founders and investors`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "business",
  icons: SITE_ICONS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — Startup discovery for founders and investors`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Startup discovery for founders and investors`,
    description: DEFAULT_DESCRIPTION,
    images: [absoluteUrl(OG_IMAGE.url)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export function orgProfileMetadata(org: {
  name: string;
  slug: string;
  one_liner?: string | null;
  logo?: string | null;
}): Metadata {
  const title = org.name;
  const description =
    org.one_liner?.trim() ||
    `View ${org.name}'s structured startup profile, credibility signals, and public updates on Beedero.`;
  const path = `/o/${org.slug}`;
  const image = org.logo
    ? { url: org.logo, alt: `${org.name} logo` }
    : OG_IMAGE;

  return pageMetadata({ title, description, path, image });
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
