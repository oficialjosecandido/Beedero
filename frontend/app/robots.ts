import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/o/",
          "/p/",
          "/verify/",
          "/startups",
          "/terms",
          "/privacy",
          "/cookies",
          "/disputes",
          "/about",
          "/register",
        ],
        disallow: [
          "/dashboard",
          "/feed",
          "/discovery",
          "/org/",
          "/invite/",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
