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
        Beedero only uses cookies that are strictly necessary for the platform to function.
        We do not use advertising or third-party tracking cookies.
      </p>

      <h2>Cookies we use</h2>
      <ul>
        <li>
          <strong>Authentication session</strong> — an httpOnly cookie that keeps you securely
          logged in while you use the app.
        </li>
      </ul>

      <h2>Purpose</h2>
      <p>
        These cookies are essential for authentication, security, and fraud prevention.
        Without them you cannot log in or use authenticated areas of Beedero.
      </p>

      <h2>Duration</h2>
      <p>
        The session cookie expires when you log out or after a period of inactivity set by
        the server.
      </p>

      <h2>Consent</h2>
      <p>
        Strictly necessary cookies are exempt from consent requirements under Lei n.º
        41/2004 (Portugal&apos;s e-Privacy law). If we introduce analytics or third-party
        social login in the future, we will update this page and obtain your consent before
        activating any non-essential cookies.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
      </p>
    </LegalPageShell>
  );
}
