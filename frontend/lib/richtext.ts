export type ResolvedMention = {
  marker: string;
  type: "user" | "org";
  name: string;
  handle?: string;
  slug?: string;
};

const URL_RE = /https?:\/\/[^\s<>"']+/;
const TRAILING_PUNCTUATION_RE = /[).,;:!?\]}'"]+$/;

export function stripTrailingPunctuation(url: string): string {
  return url.replace(TRAILING_PUNCTUATION_RE, "");
}

/** First http(s) URL in a post/comment body, used to back a lazy link-preview
 * fetch (spec §A2) — independent of RichText's own inline linkification. */
export function extractFirstUrl(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = URL_RE.exec(body);
  if (!match) return null;
  const url = stripTrailingPunctuation(match[0]);
  return url || null;
}
