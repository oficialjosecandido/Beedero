import { publicFetch } from "@/lib/api";
import { BETA_STATUS } from "@/lib/seo-content";

/**
 * Below this the number is worse than the word: "1 startup" reads as empty,
 * where "in beta" reads as early. At or above it the count wins, because a
 * reader can open Discover and check it — which is the whole argument the
 * site is making about itself.
 */
export const MIN_LISTED_TO_COUNT = 5;

/**
 * What the home page says about where Beedero is.
 *
 * The number is read live from the same endpoint `/startups` reads, so the
 * page cannot go stale and nobody has to remember to edit a figure. If the
 * count is too small to help, or the API is slow, the sentence falls back to
 * `BETA_STATUS` — the home page is not worth failing over a count.
 *
 * Note that this counts organisations *listed in Discover*, which is a
 * narrower set than the organisations that exist: an org also needs a plan
 * and the completeness gate in `orgs/ladder.py` to appear. That is on
 * purpose — this sentence is only credible if the reader can go and find the
 * things it counts.
 */
export async function statusLine(): Promise<string> {
  try {
    const { total } = await publicFetch<{ total: number }>("/public/discovery/?limit=1", 600);
    if (typeof total === "number" && total >= MIN_LISTED_TO_COUNT) {
      return `Beedero is in beta. ${total} startups and companies have a page here today, and Discover lists every one of them.`;
    }
  } catch {
    // Fall through to the sentence that needs no data.
  }
  return BETA_STATUS;
}
