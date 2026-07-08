"use server";

import { apiFetch } from "@/lib/api";
import type { FeedItem } from "./types";

export async function loadMoreFeedAction(cursor: string): Promise<{
  items: FeedItem[];
  next_cursor: string | null;
}> {
  return apiFetch(`/feed/?cursor=${encodeURIComponent(cursor)}`);
}
