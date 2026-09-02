import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  // Profile/ logo uploads go through Server Actions (multipart). Default 1MB
  // rejects most phone photos before our action runs.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/org/:slug",
        destination: "/o/:slug",
        permanent: true,
      },
      { source: "/sobre", destination: "/about", permanent: true },
      { source: "/litigios", destination: "/disputes", permanent: true },
      { source: "/termos", destination: "/terms", permanent: true },
      { source: "/privacidade", destination: "/privacy", permanent: true },
      { source: "/pricing", destination: "/", permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
