import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

/** Sentry's CSP collector for this project, derived from the public DSN
 * (`https://<key>@<host>/<project>`). Without a DSN the report-only policy
 * still applies — the browser just has nowhere to send violations. */
function cspReportUri(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    const { username, host, pathname } = new URL(dsn);
    const projectId = pathname.replace(/^\//, "");
    if (!username || !projectId) return null;
    return `https://${host}/api/${projectId}/security/?sentry_key=${username}`;
  } catch {
    return null;
  }
}

/** Directives that cannot break a page that already works, so they go out
 * enforced. Shared with the report-only policy (minus upgrade-insecure-
 * requests, which browsers ignore — and warn about — in report-only). */
const ENFORCED_CSP_CORE = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

/** Enforced CSP. `upgrade-insecure-requests` only belongs here — it is not a
 * reportable directive. */
const ENFORCED_CSP = `${ENFORCED_CSP_CORE}; upgrade-insecure-requests`;

/** The policy we intend to enforce. Report-only for now because the app has
 * never run under a CSP: Next inlines its own bootstrap scripts and Tailwind
 * its styles, so enforcing `script-src`/`style-src` without watching real
 * traffic first would white-screen the site, and nonces are not an option
 * while the public pages need to stay statically rendered (they are what SEO
 * reads). Promote it to `Content-Security-Policy` once the reports are quiet.
 *
 * `img-src https:` is deliberately wide: rich link previews render the
 * publisher's own image, which can be any host on the web. */
function reportOnlyCsp(): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Firebase email-link sign-in and Cloud Messaging; GA4. The API itself is
    // same-origin — the browser only ever talks to /api/* route handlers.
    [
      "connect-src 'self'",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://fcmregistrations.googleapis.com",
      "https://fcm.googleapis.com",
      "https://*.google-analytics.com",
      "https://*.googletagmanager.com",
      "https://*.analytics.google.com",
    ].join(" "),
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "frame-src 'none'",
    ENFORCED_CSP_CORE,
  ];
  const reportUri = cspReportUri();
  if (reportUri) directives.push(`report-uri ${reportUri}`);
  return directives.join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: ENFORCED_CSP },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Belt and braces with `frame-ancestors` above, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Sign-in is an emailed link, never a popup, so isolation costs nothing.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // No `preload`: that is a submission to a browser-maintained list and is
  // effectively irreversible, so it belongs to a deliberate decision rather
  // than a config change.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Profile/ logo uploads go through Server Actions (multipart). Default 1MB
  // rejects most phone photos before our action runs.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      {
        // Personal profile moved off `/dashboard` so it no longer collides
        // with the org workspace at `/dashboard/[slug]` under `(org)`.
        source: "/dashboard",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/org/:slug",
        destination: "/o/:slug",
        permanent: true,
      },
      {
        // The multi-step wizard became one page under `(org)`; links and
        // bookmarks to the old route still work.
        source: "/organisations/new",
        destination: "/orgs/new",
        permanent: false,
      },
      { source: "/sobre", destination: "/about", permanent: true },
      { source: "/litigios", destination: "/disputes", permanent: true },
      { source: "/termos", destination: "/terms", permanent: true },
      { source: "/privacidade", destination: "/privacy", permanent: true },
      { source: "/perguntas", destination: "/faq", permanent: true },
      { source: "/casos", destination: "/cases", permanent: true },
      { source: "/obrigado", destination: "/thanks", permanent: true },
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
