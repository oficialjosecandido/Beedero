import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { COMPANY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description: "How Beedero uses cookies and similar technologies.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookie Policy">
      <p>
        Beedero uses cookies that are strictly necessary for the platform to function, plus
        optional analytics only when configured. We do not use advertising cookies.
      </p>

      <h2>Cookies we use</h2>
      <ul>
        <li>
          <strong>Authentication session</strong> — an httpOnly cookie that keeps you securely
          logged in while you use the app.
        </li>
        <li>
          <strong>First-party page views</strong> — a server beacon records which public paths
          were opened (no advertising profile). It does not set a tracking cookie.
        </li>
        <li>
          <strong>Google Analytics (optional)</strong> — only if the site is deployed with a
          measurement ID. IP anonymisation is enabled. Until that ID is set, GA scripts are not
          loaded.
        </li>
      </ul>

      <h2>Purpose</h2>
      <p>
        Session cookies are essential for authentication, security, and fraud prevention.
        Analytics help us understand which pages are useful so we can improve Beedero.
      </p>

      <h2>Duration</h2>
      <p>
        The session cookie expires when you log out or after a period of inactivity set by
        the server. Analytics cookies, when present, follow Google&apos;s retention defaults.
      </p>

      <h2>Consent</h2>
      <p>
        Strictly necessary cookies are exempt from consent requirements under Lei n.º
        41/2004 (Portugal&apos;s e-Privacy law). If Google Analytics is enabled on this
        deployment, we treat it as optional measurement and will expand this notice and
        consent flow before relying on advertising or non-essential third-party cookies.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
      </p>
    </LegalPageShell>
  );
}
