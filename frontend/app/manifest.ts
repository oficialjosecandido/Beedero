import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beedero",
    short_name: "Beedero",
    description:
      "Structured startup profiles, verified credibility, and discovery for founders and investors.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffe600",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/og.png",
        sizes: "1200x630",
        type: "image/png",
      },
    ],
  };
}
