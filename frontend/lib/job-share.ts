import { SITE_URL } from "./site-metadata";

import { refFor } from "./signup-ref";

/**
 * The shareable address of a job — doc §3.4.
 *
 * `?ref=share:<org>` is the measurement half: §8.3's funnel wants to know which
 * orgs' own sharing brought people who stayed, and the only way to know is for
 * the link an org hands out to say so. The ref goes through `refFor`, so a slug
 * that can't be expressed as one degrades to a bare `share` rather than
 * producing a link with a malformed query.
 */
export function jobShareUrl(jobId: number, orgSlug: string): string {
  const ref = refFor("share", orgSlug);
  return `${SITE_URL}/jobs/${jobId}${ref ? `?ref=${ref}` : ""}`;
}

/** The one line that goes out with the link. */
export function jobShareText(jobTitle: string, orgName: string): string {
  return `${orgName} is hiring: ${jobTitle}`;
}

/**
 * LinkedIn's composer, pre-filled — "texto pré-preenchido" in §3.4.
 *
 * Deliberately not `/sharing/share-offsite/`, which takes a URL and ignores
 * every text parameter it is given, so the post would go out with no sentence
 * of the org's own. This endpoint opens the real composer with the text in it;
 * LinkedIn unfurls the URL inside the text into the usual card, so the preview
 * still comes from the page's own OG tags.
 */
export function linkedInShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ shareActive: "true", text: `${text}\n\n${url}` });
  return `https://www.linkedin.com/feed/?${params.toString()}`;
}
