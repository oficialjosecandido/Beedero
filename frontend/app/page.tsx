import { LandingPage } from "@/components/landing/LandingPage";
import { WebsiteJsonLd } from "@/components/WebsiteJsonLd";
import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

/**
 * Lighthouse / SEO: audit `/` and `/lighthouse-demo` (static public dashboard).
 * Seeded `/o/lighthouse-demo` and `/p/lighthouse-demo` are secondary. Do not
 * audit `/login` for SEO — it is intentionally noindex.
 */
export const metadata = pageMetadata({
  title: "The network for people in motion",
  description:
    "Beedero is where founders, professionals, companies and investors move forward — with profiles, discovery and privacy controls that keep trust intact.",
  path: "/",
  keywords: [
    "professional network",
    "startup network",
    "founders",
    "investors",
    "advisors",
    "startup discovery",
    "verified company profile",
  ],
});

export default async function Home() {
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));
  const primaryHref = authed ? "/feed" : "/register";
  const primaryLabel = authed ? "Enter Beedero" : "Join Beedero";

  return (
    <>
      <WebsiteJsonLd />
      <LandingPage primaryHref={primaryHref} primaryLabel={primaryLabel} />
    </>
  );
}
