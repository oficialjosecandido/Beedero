import { publicFetch } from "@/lib/api";

/** José's own handle on Beedero — the founder is a member like anyone else. */
export const FOUNDER_HANDLE = "josecandido";

export type FounderProfile = {
  full_name: string;
  headline?: string;
  profile_picture?: string | null;
  handle: string;
};

/**
 * The photo and name come from José's own public profile, so there is one
 * place to change them and the site shows a real person who is also a real
 * member of it.
 *
 * Returns null when the API is unreachable, and both callers render without a
 * photo rather than failing the page — the home page and /about are the two
 * pages a stranger reaches first.
 */
export async function loadFounder(): Promise<FounderProfile | null> {
  try {
    const data = await publicFetch<{ person: FounderProfile }>(
      `/public/people/${FOUNDER_HANDLE}/`,
      3600,
    );
    return data.person;
  } catch {
    return null;
  }
}
