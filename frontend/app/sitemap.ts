import type { MetadataRoute } from "next";

import { publicFetch } from "@/lib/api";
import { SITE_URL } from "@/lib/site-metadata";

type SitemapPayload = {
  orgs: { slug: string; lastmod: string }[];
  people: { handle: string; lastmod: string }[];
  verify: { slug: string; lastmod: string }[];
};

function staticEntries(lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/startups`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/register`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/cookies`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/disputes`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const entries = staticEntries(lastModified);

  try {
    const data = await publicFetch<SitemapPayload>("/public/sitemap/", 3600);

    for (const org of data.orgs) {
      entries.push({
        url: `${SITE_URL}/o/${org.slug}`,
        lastModified: org.lastmod,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const person of data.people) {
      entries.push({
        url: `${SITE_URL}/p/${person.handle}`,
        lastModified: person.lastmod,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const verify of data.verify) {
      entries.push({
        url: `${SITE_URL}/verify/${verify.slug}`,
        lastModified: verify.lastmod,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Fall back to static marketing URLs if the API is unreachable during build.
  }

  return entries;
}
