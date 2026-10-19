import { SITE_URL } from "@/lib/site-metadata";

import type { FeedItem } from "./types";

/** Deep link back into the home feed focused on this activity. */
export function feedPostShareUrl(activityId: number): string {
  return `${SITE_URL}/feed?post=${activityId}`;
}

export function feedPostShareText(item: FeedItem): string {
  const author =
    item.type === "org" ? item.org?.name : item.author?.name;
  const title = item.value.title?.trim();
  const body = item.value.body?.trim();
  const headline =
    title && title !== "Update"
      ? title
      : body
        ? body.length > 160
          ? `${body.slice(0, 157)}...`
          : body
        : "Update on Beedero";
  return author ? `${author}: ${headline}` : headline;
}

/**
 * Prefer the platform share sheet; fall back to clipboard. Returns which
 * path succeeded so the caller can toast.
 */
export async function shareFeedPost(
  item: FeedItem
): Promise<"shared" | "copied" | "cancelled"> {
  const url = feedPostShareUrl(item.id);
  const title = item.value.title?.trim() || "Update on Beedero";
  const text = feedPostShareText(item);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Fall through to clipboard when the share sheet isn't usable.
    }
  }

  await navigator.clipboard.writeText(`${text}\n\n${url}`);
  return "copied";
}
