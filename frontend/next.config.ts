import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const backendRoot = (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/api\/?$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/badge/:slug.svg",
        destination: `${backendRoot}/api/public/badge/:slug/svg/`,
      },
      {
        source: "/badge/:slug.json",
        destination: `${backendRoot}/api/public/badge/:slug/json/`,
      },
      {
        source: "/pbadge/:handle.svg",
        destination: `${backendRoot}/api/public/pbadge/:handle/svg/`,
      },
      {
        source: "/pbadge/:handle.json",
        destination: `${backendRoot}/api/public/pbadge/:handle/json/`,
      },
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
