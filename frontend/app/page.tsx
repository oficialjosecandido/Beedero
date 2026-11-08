import { LandingPage } from "@/components/landing/LandingPage";
import { WebsiteJsonLd } from "@/components/WebsiteJsonLd";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_KEYWORDS } from "@/lib/seo-content";
import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

/**
 * Lighthouse / SEO: audit `/` and `/lighthouse-demo` (static public dashboard).
 * Persona landings (/for-founders, /for-professionals, /for-startups,
 * /for-companies) carry the value-prop keywords. Do not audit `/login` for SEO.
 */
export const metadata = pageMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: "/",
  keywords: [...SITE_KEYWORDS],
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
