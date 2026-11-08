import type { Metadata } from "next";

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_KEYWORDS,
  SITE_NAME,
} from "@/lib/seo-content";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://beedero.com").replace(/\/$/, "");

export { SITE_NAME };

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Beedero — verified network for founders, talent and companies",
} as const;

export const SITE_ICONS = {
  icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  shortcut: "/favicon.svg",
  apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};

type OgImageInput = { url: string; width?: number; height?: number; alt: string };

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeOgImage(image: OgImageInput) {
  return {
    url: absoluteUrl(image.url),
    width: image.width ?? OG_IMAGE.width,
    height: image.height ?? OG_IMAGE.height,
    alt: image.alt,
  };
}

type PageMetadataOptions = {
  title: string;
  description?: string;
  path: string;
  index?: boolean;
  /**
   * Defaults to `index`, which is right for almost every page: something worth
   * hiding is usually worth hiding the links of. Paginated pages are the
   * exception — page 2 of a list is a duplicate nobody should land on, but it
   * is the only route a crawler has to the items on it, so they pass
   * `follow: true` alongside `index: false`.
   */
  follow?: boolean;
  image?: OgImageInput;
  openGraphType?: "website" | "profile";
  keywords?: string[];
};

export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  index = true,
  follow = index,
  image = OG_IMAGE,
  openGraphType = "website",
  keywords,
}: PageMetadataOptions): Metadata {
  const canonical = absoluteUrl(path);
  const ogImage = normalizeOgImage(image);
  const fullTitle = `${title} · ${SITE_NAME}`;

  return {
    title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: openGraphType,
      siteName: SITE_NAME,
      locale: "en_US",
      title: fullTitle,
      description,
      url: canonical,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage.url],
    },
    robots: { index, follow, googleBot: { index, follow } },
  };
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${DEFAULT_TITLE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "business",
  icons: SITE_ICONS,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  keywords: [...SITE_KEYWORDS],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — ${DEFAULT_TITLE}`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [normalizeOgImage(OG_IMAGE)],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${DEFAULT_TITLE}`,
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
    `View ${org.name} on Beedero — a verified organisation page with team, updates and credibility signals.`;
  const path = `/o/${org.slug}`;
  const image = org.logo
    ? { url: org.logo, alt: `${org.name} logo on Beedero` }
    : OG_IMAGE;

  return pageMetadata({
    title,
    description,
    path,
    image,
    keywords: [org.name, "verified organisation", "startup profile", "Beedero", org.slug],
  });
}

export function personProfileMetadata(person: {
  handle: string;
  full_name: string;
  headline?: string;
  profile_picture?: string | null;
}): Metadata {
  const title = person.full_name;
  const description =
    person.headline?.trim() ||
    `${person.full_name}'s verified professional profile on Beedero — organisation-confirmed roles, skills and credibility.`;
  const path = `/p/${person.handle}`;
  const image = person.profile_picture
    ? { url: person.profile_picture, alt: `${person.full_name} profile photo` }
    : OG_IMAGE;

  return pageMetadata({
    title,
    description,
    path,
    image,
    openGraphType: "profile",
    keywords: [person.full_name, "verified professional profile", "Beedero", person.handle],
  });
}

export function verifyPageMetadata(org: {
  slug: string;
  name: string;
  one_liner?: string | null;
  logo?: string | null;
}): Metadata {
  const title = `${org.name} — Beedero verification`;
  const description =
    org.one_liner?.trim() ||
    `Check ${org.name}'s public credibility and verification ladder on Beedero.`;
  const path = `/verify/${org.slug}`;
  const image = org.logo
    ? { url: org.logo, alt: `${org.name} verification on Beedero` }
    : OG_IMAGE;

  return pageMetadata({
    title,
    description,
    path,
    image,
    keywords: [org.name, "startup verification", "company verification", "credibility", "Beedero"],
  });
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export function missingPageMetadata(title: string): Metadata {
  return { title, ...noIndexMetadata };
}
