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
          "/jobs",
          "/terms",
          "/privacy",
          "/cookies",
          "/disputes",
          "/about",
          "/register",
        ],
        disallow: [
          // The role pages themselves are the point of /jobs; applying is a
          // form behind a session, and /opportunities is the members' board.
          "/jobs/*/apply",
          "/opportunities",
          "/profile",
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
